import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") ?? ""
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    .auth.getUser(token)
  return user
}

interface Connection {
  id: string
  access_token: string
  refresh_token: string | null
  token_expiry: string | null
}

// deno-lint-ignore no-explicit-any
async function getValidAccessToken(db: any, userId: string): Promise<string | null> {
  const { data: conn } = await db
    .from("google_docs_connections")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle()

  if (!conn) return null
  const c = conn as Connection

  const now = Date.now()
  const expiresAt = c.token_expiry ? new Date(c.token_expiry).getTime() : 0
  // Renouveler 60s avant expiration
  if (expiresAt - 60_000 > now) return c.access_token

  if (!c.refresh_token) return c.access_token

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: c.refresh_token,
      grant_type:    "refresh_token",
    }),
  })
  const refreshed = await refreshRes.json()
  if (!refreshRes.ok || !refreshed.access_token) {
    return c.access_token
  }

  const newExpiry = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null

  await db.from("google_docs_connections").update({
    access_token: refreshed.access_token,
    token_expiry: newExpiry,
  }).eq("id", c.id)

  return refreshed.access_token
}

// Extrait l'ID d'un Doc depuis une URL ou retourne tel quel si déjà un ID
function extractDocId(input: string): string | null {
  if (!input) return null
  const m = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  // Si c'est juste un id (44 chars typiques)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

// Récupère les premières lignes de texte du document
function extractPreview(doc: any, maxChars = 600): string {
  const content: any[] = doc?.body?.content ?? []
  const parts: string[] = []
  for (const el of content) {
    if (parts.join(" ").length >= maxChars) break
    const para = el?.paragraph?.elements
    if (!Array.isArray(para)) continue
    for (const e of para) {
      const t = e?.textRun?.content
      if (typeof t === "string") parts.push(t)
    }
  }
  return parts.join("").replace(/\n+/g, " ").trim().slice(0, maxChars)
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const user = await getUser(req)
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401)

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const action = body?.action as string

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // ── list_links : retourne les liens pour une liste de tâches app ─────────
  if (action === "list_links") {
    const ids: string[] = Array.isArray(body.app_task_ids) ? body.app_task_ids : []
    if (ids.length === 0) return jsonResponse({ links: [] })
    const { data, error } = await db
      .from("google_docs_links")
      .select("*")
      .eq("user_id", user.id)
      .in("app_task_id", ids)
      .order("created_at", { ascending: false })
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ links: data ?? [] })
  }

  // ── unlink ───────────────────────────────────────────────────────────────
  if (action === "unlink") {
    const linkId = body.link_id as string
    if (!linkId) return jsonResponse({ error: "link_id manquant" }, 400)
    const { error } = await db
      .from("google_docs_links")
      .delete()
      .eq("id", linkId)
      .eq("user_id", user.id)
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ success: true })
  }

  // ── disconnect ───────────────────────────────────────────────────────────
  if (action === "disconnect") {
    await db.from("google_docs_connections").delete().eq("user_id", user.id)
    await db.from("member_integrations")
      .update({
        is_connected: false,
        connected_at: null,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("integration", "google_docs")
    return jsonResponse({ success: true })
  }

  // ── Actions nécessitant un token Google ──────────────────────────────────
  const accessToken = await getValidAccessToken(db, user.id)
  if (!accessToken) {
    return jsonResponse({ error: "Compte Google Docs non connecté." }, 400)
  }

  // ── link_doc : lier un Doc existant à une tâche ──────────────────────────
  if (action === "link_doc") {
    const appTaskId = body.app_task_id as string
    const input     = (body.input as string) ?? ""
    if (!appTaskId || !input) return jsonResponse({ error: "Paramètres manquants" }, 400)

    const docId = extractDocId(input)
    if (!docId) return jsonResponse({ error: "Lien Google Doc invalide" }, 400)

    // Récupérer titre + contenu via l'API Docs
    const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!docRes.ok) {
      const txt = await docRes.text()
      return jsonResponse({ error: `Impossible d'accéder au document : ${txt}` }, 400)
    }
    const doc = await docRes.json()
    const title = doc?.title ?? "Document sans titre"
    const preview = extractPreview(doc)
    const webViewLink = `https://docs.google.com/document/d/${docId}/edit`

    const payload = {
      user_id: user.id,
      app_task_id: appTaskId,
      google_doc_id: docId,
      title,
      web_view_link: webViewLink,
      preview_text: preview,
      preview_updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from("google_docs_links")
      .upsert(payload, { onConflict: "user_id,app_task_id,google_doc_id" })
      .select()
      .single()

    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ link: data })
  }

  // ── create_doc : crée un nouveau Doc et l'attache ────────────────────────
  if (action === "create_doc") {
    const appTaskId = body.app_task_id as string
    const docTitle  = (body.title as string) ?? "Nouveau document"
    if (!appTaskId) return jsonResponse({ error: "app_task_id manquant" }, 400)

    const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: docTitle }),
    })
    if (!createRes.ok) {
      const txt = await createRes.text()
      return jsonResponse({ error: `Création impossible : ${txt}` }, 400)
    }
    const created = await createRes.json()
    const docId = created.documentId
    const webViewLink = `https://docs.google.com/document/d/${docId}/edit`

    const payload = {
      user_id: user.id,
      app_task_id: appTaskId,
      google_doc_id: docId,
      title: created.title ?? docTitle,
      web_view_link: webViewLink,
      preview_text: "",
      preview_updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from("google_docs_links")
      .upsert(payload, { onConflict: "user_id,app_task_id,google_doc_id" })
      .select()
      .single()

    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ link: data })
  }

  // ── refresh_preview : recharge titre + extrait du contenu ────────────────
  if (action === "refresh_preview") {
    const linkId = body.link_id as string
    if (!linkId) return jsonResponse({ error: "link_id manquant" }, 400)

    const { data: link, error: fetchErr } = await db
      .from("google_docs_links")
      .select("*")
      .eq("id", linkId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (fetchErr || !link) return jsonResponse({ error: "Lien introuvable" }, 404)

    const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${link.google_doc_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!docRes.ok) {
      const txt = await docRes.text()
      return jsonResponse({ error: `Impossible d'accéder au document : ${txt}` }, 400)
    }
    const doc = await docRes.json()
    const title = doc?.title ?? link.title
    const preview = extractPreview(doc)

    const { data, error } = await db
      .from("google_docs_links")
      .update({
        title,
        preview_text: preview,
        preview_updated_at: new Date().toISOString(),
      })
      .eq("id", linkId)
      .select()
      .single()

    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ link: data })
  }

  return jsonResponse({ error: `Action inconnue : ${action}` }, 400)
})
