// Edge function : google-tasks-api
// Actions disponibles :
//   - get_connection : retourne { connected }
//   - disconnect     : supprime la connexion
//   - list_tasklists : liste les listes Google Tasks de l'utilisateur
//   - list_tasks     : liste les tâches d'une liste donnée
//   - push_task      : crée/met à jour une tâche Google à partir d'une tâche app
//   - import_tasklist: importe toutes les tâches non terminées d'une liste Google vers un projet
//   - sync_status    : retourne les infos de mapping pour un projet
//
// Réutilise les credentials GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const GOOGLE_CLIENT_ID      = Deno.env.get("GOOGLE_CLIENT_ID")!
const GOOGLE_CLIENT_SECRET  = Deno.env.get("GOOGLE_CLIENT_SECRET")!

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
}

const TASKS_API = "https://tasks.googleapis.com/tasks/v1"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS })
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token)
  return user
}

// Refresh token Google si nécessaire
async function refreshIfNeeded(db: any, conn: any): Promise<string | null> {
  const expiry = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0
  // Marge de 60s
  if (expiry - 60_000 > Date.now()) return conn.access_token

  if (!conn.refresh_token) {
    console.error("[google-tasks-api] Token expired and no refresh_token available")
    return null
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
      grant_type:    "refresh_token",
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error("[google-tasks-api] Refresh failed:", data)
    return null
  }
  const newToken = data.access_token as string
  const newExpiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  await db
    .from("google_tasks_connections")
    .update({ access_token: newToken, token_expiry: newExpiry })
    .eq("id", conn.id)

  return newToken
}

async function gApi(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${TASKS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    const err = new Error(`Google Tasks API ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`)
    ;(err as any).status = res.status
    throw err
  }
  return body
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const user = await getUser(req)
    if (!user) return json({ error: "Unauthorized" }, 401)

    const { action, ...payload } = await req.json().catch(() => ({} as any))
    if (!action) return json({ error: "Missing action" }, 400)

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── get_connection ──────────────────────────────────────────────────────
    if (action === "get_connection") {
      const { data } = await db
        .from("google_tasks_connections")
        .select("id, email, display_name")
        .eq("user_id", user.id)
        .maybeSingle()
      return json({ connected: !!data, account: data ?? null })
    }

    // ── disconnect ──────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await db.from("google_tasks_connections").delete().eq("user_id", user.id)
      await db.from("google_tasklist_links").delete().eq("user_id", user.id)
      await db
        .from("member_integrations")
        .update({
          is_connected: false,
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("integration", "google_tasks")
      return json({ success: true })
    }

    // Toutes les autres actions nécessitent une connexion + token valide
    const { data: conn } = await db
      .from("google_tasks_connections")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (!conn) return json({ error: "Not connected to Google Tasks" }, 403)

    const token = await refreshIfNeeded(db, conn)
    if (!token) return json({ error: "Token refresh failed, please reconnect" }, 401)

    // ── list_tasklists ──────────────────────────────────────────────────────
    if (action === "list_tasklists") {
      const data = await gApi(token, "/users/@me/lists?maxResults=100")
      return json({
        tasklists: (data.items ?? []).map((l: any) => ({
          id: l.id,
          title: l.title,
          updated: l.updated,
        })),
      })
    }

    // ── list_tasks ──────────────────────────────────────────────────────────
    if (action === "list_tasks") {
      const tasklistId = payload.tasklist_id
      if (!tasklistId) return json({ error: "Missing tasklist_id" }, 400)
      const showCompleted = payload.show_completed ?? false
      const params = new URLSearchParams({
        maxResults: "100",
        showCompleted: String(showCompleted),
        showHidden: "false",
      })
      const data = await gApi(token, `/lists/${encodeURIComponent(tasklistId)}/tasks?${params}`)
      return json({
        tasks: (data.items ?? []).map((t: any) => ({
          id: t.id,
          title: t.title,
          notes: t.notes ?? null,
          due: t.due ?? null,
          status: t.status,
          completed: t.completed ?? null,
          updated: t.updated,
        })),
      })
    }

    // ── push_task ───────────────────────────────────────────────────────────
    // Crée la tâche dans Google si pas encore liée, sinon met à jour.
    if (action === "push_task") {
      const { app_task_id, tasklist_id, title, notes, due, completed } = payload
      if (!app_task_id || !tasklist_id || !title) {
        return json({ error: "Missing app_task_id, tasklist_id or title" }, 400)
      }

      // Existant ?
      const { data: link } = await db
        .from("google_tasklist_links")
        .select("*")
        .eq("user_id", user.id)
        .eq("app_task_id", app_task_id)
        .eq("google_tasklist_id", tasklist_id)
        .maybeSingle()

      const body: Record<string, unknown> = {
        title: String(title).slice(0, 1024),
        status: completed ? "completed" : "needsAction",
      }
      if (notes) body.notes = String(notes).slice(0, 8192)
      if (due) {
        // Google Tasks exige RFC3339 ; on accepte ISO
        body.due = new Date(due).toISOString()
      }

      let googleTask: any
      if (link?.google_task_id) {
        // Vérifier que la tâche existe encore dans Google
        try {
          googleTask = await gApi(
            token,
            `/lists/${encodeURIComponent(tasklist_id)}/tasks/${encodeURIComponent(link.google_task_id)}`,
            { method: "PATCH", body: JSON.stringify(body) },
          )
        } catch (e: any) {
          if (e.status === 404) {
            // Tâche supprimée côté Google → on recrée
            googleTask = await gApi(
              token,
              `/lists/${encodeURIComponent(tasklist_id)}/tasks`,
              { method: "POST", body: JSON.stringify(body) },
            )
            await db.from("google_tasklist_links").delete().eq("id", link.id)
          } else {
            throw e
          }
        }
      } else {
        googleTask = await gApi(
          token,
          `/lists/${encodeURIComponent(tasklist_id)}/tasks`,
          { method: "POST", body: JSON.stringify(body) },
        )
      }

      // Upsert mapping
      const linkPayload = {
        user_id: user.id,
        app_task_id,
        google_tasklist_id: tasklist_id,
        google_task_id: googleTask.id,
        direction: "push",
        last_synced_at: new Date().toISOString(),
      }
      const { data: existing } = await db
        .from("google_tasklist_links")
        .select("id")
        .eq("user_id", user.id)
        .eq("app_task_id", app_task_id)
        .eq("google_task_id", googleTask.id)
        .maybeSingle()

      if (existing?.id) {
        await db.from("google_tasklist_links").update(linkPayload).eq("id", existing.id)
      } else {
        await db.from("google_tasklist_links").insert(linkPayload)
      }

      return json({ success: true, google_task: googleTask })
    }

    // ── import_tasklist ─────────────────────────────────────────────────────
    // Récupère les tâches d'une liste Google et retourne les nouvelles à créer.
    // (La création effective des tâches dans l'app se fait côté client : on a
    //  besoin de project_id, list_id, etc. qui dépendent du contexte UI.)
    if (action === "import_tasklist") {
      const tasklistId = payload.tasklist_id
      if (!tasklistId) return json({ error: "Missing tasklist_id" }, 400)
      const showCompleted = payload.show_completed ?? false

      const params = new URLSearchParams({
        maxResults: "100",
        showCompleted: String(showCompleted),
        showHidden: "false",
      })
      const data = await gApi(token, `/lists/${encodeURIComponent(tasklistId)}/tasks?${params}`)
      const items = data.items ?? []

      // Quels google_task_id sont déjà importés ?
      const ids = items.map((t: any) => t.id)
      let importedIds = new Set<string>()
      if (ids.length) {
        const { data: links } = await db
          .from("google_tasklist_links")
          .select("google_task_id")
          .eq("user_id", user.id)
          .eq("google_tasklist_id", tasklistId)
          .in("google_task_id", ids)
        importedIds = new Set((links ?? []).map((l: any) => l.google_task_id))
      }

      return json({
        tasks: items.map((t: any) => ({
          id: t.id,
          title: t.title,
          notes: t.notes ?? null,
          due: t.due ?? null,
          status: t.status,
          completed: t.completed ?? null,
          already_imported: importedIds.has(t.id),
        })),
      })
    }

    // ── confirm_import ──────────────────────────────────────────────────────
    // Le client a créé les tâches dans l'app, il enregistre maintenant le mapping.
    if (action === "confirm_import") {
      const { tasklist_id, mappings } = payload as {
        tasklist_id: string
        mappings: { google_task_id: string; app_task_id: string }[]
      }
      if (!tasklist_id || !Array.isArray(mappings)) {
        return json({ error: "Missing tasklist_id or mappings" }, 400)
      }
      const rows = mappings.map(m => ({
        user_id: user.id,
        app_task_id: m.app_task_id,
        google_tasklist_id: tasklist_id,
        google_task_id: m.google_task_id,
        direction: "import",
        last_synced_at: new Date().toISOString(),
      }))
      if (rows.length) {
        // upsert manuel (UNIQUE sur user_id, app_task_id, google_task_id)
        for (const row of rows) {
          const { data: existing } = await db
            .from("google_tasklist_links")
            .select("id")
            .eq("user_id", user.id)
            .eq("app_task_id", row.app_task_id)
            .eq("google_task_id", row.google_task_id)
            .maybeSingle()
          if (existing?.id) {
            await db.from("google_tasklist_links").update(row).eq("id", existing.id)
          } else {
            await db.from("google_tasklist_links").insert(row)
          }
        }
      }
      return json({ success: true, imported: rows.length })
    }

    // ── unlink_task ─────────────────────────────────────────────────────────
    if (action === "unlink_task") {
      const { app_task_id, google_task_id } = payload
      if (!app_task_id) return json({ error: "Missing app_task_id" }, 400)
      let q = db.from("google_tasklist_links").delete()
        .eq("user_id", user.id)
        .eq("app_task_id", app_task_id)
      if (google_task_id) q = q.eq("google_task_id", google_task_id)
      await q
      return json({ success: true })
    }

    // ── list_links ──────────────────────────────────────────────────────────
    // Pour une liste d'app_task_ids, retourne les mappings existants.
    if (action === "list_links") {
      const ids: string[] = payload.app_task_ids ?? []
      if (!ids.length) return json({ links: [] })
      const { data } = await db
        .from("google_tasklist_links")
        .select("app_task_id, google_task_id, google_tasklist_id, direction, last_synced_at")
        .eq("user_id", user.id)
        .in("app_task_id", ids)
      return json({ links: data ?? [] })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err: any) {
    console.error("[google-tasks-api] Error:", err)
    return json({ error: err.message ?? "Internal error" }, 500)
  }
})
