import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!
const GOOGLE_CLIENT_ID     = Deno.env.get("GOOGLE_CLIENT_ID") ?? ""
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

// deno-lint-ignore no-explicit-any
async function getAccessToken(db: any, userId: string): Promise<string | null> {
  const { data: conn } = await db
    .from("google_docs_connections")
    .select("id, access_token, refresh_token, token_expiry")
    .eq("user_id", userId)
    .maybeSingle()

  if (!conn) return null

  const expiresAt = conn.token_expiry ? new Date(conn.token_expiry).getTime() : 0
  if (expiresAt - 60_000 > Date.now()) return conn.access_token
  if (!conn.refresh_token) return conn.access_token

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
  if (!res.ok || !data.access_token) return conn.access_token

  const newExpiry = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000).toISOString()
    : null

  await db.from("google_docs_connections").update({
    access_token: data.access_token,
    token_expiry: newExpiry,
  }).eq("id", conn.id)

  return data.access_token
}

// deno-lint-ignore no-explicit-any
function extractText(doc: any): string {
  const parts: string[] = []
  const content: any[] = doc?.body?.content ?? []
  for (const el of content) {
    const para = el?.paragraph?.elements
    if (!Array.isArray(para)) continue
    for (const e of para) {
      const t = e?.textRun?.content
      if (typeof t === "string") parts.push(t)
    }
  }
  return parts.join("")
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405)

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }

  const docId = (body.doc_id as string)?.trim()
  let userId  = body.user_id as string | undefined

  if (!docId) return json({ error: "doc_id manquant" }, 400)

  if (!userId) {
    const authHeader = req.headers.get("Authorization") ?? ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""
    if (!token) return json({ error: "user_id ou Bearer token requis" }, 401)
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: { user } } = await anon.auth.getUser(token)
    if (!user) return json({ error: "Unauthorized" }, 401)
    userId = user.id
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const accessToken = await getAccessToken(db, userId)
  if (!accessToken) {
    return json({ error: "Compte Google Docs non connecté pour cet utilisateur." }, 400)
  }

  // Récupère le document Docs
  const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!docRes.ok) {
    const txt = await docRes.text()
    return json({ error: `Impossible d'accéder au document : ${txt}` }, 400)
  }
  const doc = await docRes.json()

  // Récupère last_modified via Drive (modifiedTime)
  let lastModified: string | null = null
  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${docId}?fields=modifiedTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (driveRes.ok) {
    const meta = await driveRes.json()
    lastModified = meta?.modifiedTime ?? null
  }

  return json({
    doc_id:        docId,
    title:         doc?.title ?? null,
    text_content:  extractText(doc),
    last_modified: lastModified,
  })
})
