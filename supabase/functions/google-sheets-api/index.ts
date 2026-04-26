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

const PREVIEW_RANGE = "A1:D5"

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
  token_expires_at: string | null
}

// deno-lint-ignore no-explicit-any
async function getValidAccessToken(db: any, userId: string): Promise<string | null> {
  const { data: conn } = await db
    .from("google_sheets_connections")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (!conn) return null
  const c = conn as Connection

  const now = Date.now()
  const expiresAt = c.token_expires_at ? new Date(c.token_expires_at).getTime() : 0
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
  if (!refreshRes.ok || !refreshed.access_token) return c.access_token

  const newExpiry = refreshed.expires_in
    ? new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    : null

  await db.from("google_sheets_connections").update({
    access_token: refreshed.access_token,
    token_expires_at: newExpiry,
  }).eq("id", c.id)

  return refreshed.access_token
}

// Extrait l'ID d'un Sheet depuis une URL ou retourne tel quel si déjà un ID
function extractSheetId(input: string): string | null {
  if (!input) return null
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)
  if (m) return m[1]
  if (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim())) return input.trim()
  return null
}

// deno-lint-ignore no-explicit-any
async function fetchSheetMetaAndPreview(sheetId: string, token: string): Promise<{ title: string, preview: any[][], firstSheetName: string | null }> {
  // Métadonnées : titre + nom de la première feuille
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!metaRes.ok) {
    const txt = await metaRes.text()
    throw new Error(`Impossible d'accéder au document : ${txt}`)
  }
  const meta = await metaRes.json()
  const title = meta?.properties?.title ?? "Document sans titre"
  const firstSheetName = meta?.sheets?.[0]?.properties?.title ?? null

  // Aperçu : premières cellules de la première feuille
  let preview: any[][] = []
  if (firstSheetName) {
    const range = `'${firstSheetName.replace(/'/g, "''")}'!${PREVIEW_RANGE}`
    const valRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (valRes.ok) {
      const v = await valRes.json()
      if (Array.isArray(v?.values)) preview = v.values
    }
  }
  return { title, preview, firstSheetName }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const user = await getUser(req)
  if (!user) return jsonResponse({ error: "Unauthorized" }, 401)

  // deno-lint-ignore no-explicit-any
  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }
  const action = body?.action as string

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // ── list_links ───────────────────────────────────────────────────────────
  if (action === "list_links") {
    const ids: string[] = Array.isArray(body.app_task_ids) ? body.app_task_ids : []
    if (ids.length === 0) return jsonResponse({ links: [] })
    const { data, error } = await db
      .from("google_sheets_links")
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
      .from("google_sheets_links")
      .delete()
      .eq("id", linkId)
      .eq("user_id", user.id)
    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ success: true })
  }

  // ── disconnect ───────────────────────────────────────────────────────────
  if (action === "disconnect") {
    await db.from("google_sheets_connections").delete().eq("user_id", user.id)
    await db.from("member_integrations")
      .update({
        is_connected: false,
        connected_at: null,
        updated_at:   new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("integration", "google_sheets")
    return jsonResponse({ success: true })
  }

  // ── Actions nécessitant un token Google ──────────────────────────────────
  const accessToken = await getValidAccessToken(db, user.id)
  if (!accessToken) {
    return jsonResponse({ error: "Compte Google Sheets non connecté." }, 400)
  }

  // ── link_sheet : lier un Sheet existant à une tâche ──────────────────────
  if (action === "link_sheet") {
    const appTaskId = body.app_task_id as string
    const input     = (body.input as string) ?? ""
    if (!appTaskId || !input) return jsonResponse({ error: "Paramètres manquants" }, 400)

    const sheetId = extractSheetId(input)
    if (!sheetId) return jsonResponse({ error: "Lien Google Sheet invalide" }, 400)

    let meta
    try { meta = await fetchSheetMetaAndPreview(sheetId, accessToken) }
    catch (e) { return jsonResponse({ error: (e as Error).message }, 400) }

    const webViewLink = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`
    const payload = {
      user_id: user.id,
      app_task_id: appTaskId,
      google_sheet_id: sheetId,
      title: meta.title,
      web_view_link: webViewLink,
      preview_values: meta.preview,
      preview_updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from("google_sheets_links")
      .upsert(payload, { onConflict: "user_id,app_task_id,google_sheet_id" })
      .select()
      .single()

    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ link: data })
  }

  // ── create_sheet : crée un nouveau Sheet et l'attache ────────────────────
  if (action === "create_sheet") {
    const appTaskId = body.app_task_id as string
    const sheetTitle = (body.title as string) ?? "Nouveau document"
    if (!appTaskId) return jsonResponse({ error: "app_task_id manquant" }, 400)

    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: { title: sheetTitle } }),
    })
    if (!createRes.ok) {
      const txt = await createRes.text()
      return jsonResponse({ error: `Création impossible : ${txt}` }, 400)
    }
    const created = await createRes.json()
    const sheetId = created.spreadsheetId
    const webViewLink = created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${sheetId}/edit`

    const payload = {
      user_id: user.id,
      app_task_id: appTaskId,
      google_sheet_id: sheetId,
      title: created?.properties?.title ?? sheetTitle,
      web_view_link: webViewLink,
      preview_values: [],
      preview_updated_at: new Date().toISOString(),
    }

    const { data, error } = await db
      .from("google_sheets_links")
      .upsert(payload, { onConflict: "user_id,app_task_id,google_sheet_id" })
      .select()
      .single()

    if (error) return jsonResponse({ error: error.message }, 500)
    return jsonResponse({ link: data })
  }

  // ── refresh_preview ──────────────────────────────────────────────────────
  if (action === "refresh_preview") {
    const linkId = body.link_id as string
    if (!linkId) return jsonResponse({ error: "link_id manquant" }, 400)

    const { data: link, error: fetchErr } = await db
      .from("google_sheets_links")
      .select("*")
      .eq("id", linkId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (fetchErr || !link) return jsonResponse({ error: "Lien introuvable" }, 404)

    let meta
    try { meta = await fetchSheetMetaAndPreview(link.google_sheet_id, accessToken) }
    catch (e) { return jsonResponse({ error: (e as Error).message }, 400) }

    const { data, error } = await db
      .from("google_sheets_links")
      .update({
        title: meta.title,
        preview_values: meta.preview,
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
