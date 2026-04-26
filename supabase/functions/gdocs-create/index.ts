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

/**
 * Convertit un texte markdown très simple en requêtes batchUpdate Google Docs.
 * Supporte :
 *  - "## titre"  → HEADING_2
 *  - "- item"    → bullet list
 *  - "texte"     → NORMAL_TEXT
 *
 * Stratégie : on insère TOUT le texte d'un coup à l'index 1, puis on applique
 * les styles paragraphe + bullets sur les ranges correspondants.
 */
function buildMarkdownRequests(markdown: string): {
  fullText: string
  requests: Record<string, unknown>[]
} {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n")
  const styleRequests: Record<string, unknown>[] = []
  const bulletRanges: Array<[number, number]> = []
  let index = 1 // Google Docs body content starts at index 1
  const textParts: string[] = []

  for (const raw of lines) {
    let line = raw
    let style: string | null = null
    let isBullet = false

    if (line.startsWith("## ")) {
      line = line.slice(3)
      style = "HEADING_2"
    } else if (line.startsWith("# ")) {
      line = line.slice(2)
      style = "HEADING_1"
    } else if (line.startsWith("- ")) {
      line = line.slice(2)
      isBullet = true
    }

    const segment = line + "\n"
    const start = index
    const end = index + segment.length // end is exclusive
    textParts.push(segment)

    if (style) {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: start, endIndex: end },
          paragraphStyle: { namedStyleType: style },
          fields: "namedStyleType",
        },
      })
    }
    if (isBullet) bulletRanges.push([start, end])

    index = end
  }

  const fullText = textParts.join("")

  // Bullets après styles paragraphe
  for (const [start, end] of bulletRanges) {
    styleRequests.push({
      createParagraphBullets: {
        range: { startIndex: start, endIndex: end },
        bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
      },
    })
  }

  const requests: Record<string, unknown>[] = []
  if (fullText.length > 0) {
    requests.push({
      insertText: { location: { index: 1 }, text: fullText },
    })
  }
  requests.push(...styleRequests)

  return { fullText, requests }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405)

  let body: any = {}
  try { body = await req.json() } catch { /* ignore */ }

  const title           = (body.title as string)?.trim()
  const contentMarkdown = body.content_markdown as string | undefined
  const folderId        = body.folder_id as string | undefined
  let   userId          = body.user_id as string | undefined

  if (!title) return json({ error: "title manquant" }, 400)

  // Auth : si pas de user_id fourni, lire le JWT (header Authorization)
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

  // 1) Création du doc
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title }),
  })
  if (!createRes.ok) {
    const txt = await createRes.text()
    return json({ error: `Création impossible : ${txt}` }, 400)
  }
  const created = await createRes.json()
  const docId   = created.documentId as string

  // 2) Injection du contenu markdown
  if (contentMarkdown && contentMarkdown.trim().length > 0) {
    const { requests } = buildMarkdownRequests(contentMarkdown)
    if (requests.length > 0) {
      const upRes = await fetch(
        `https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ requests }),
        },
      )
      if (!upRes.ok) {
        const txt = await upRes.text()
        return json({ error: `Insertion contenu impossible : ${txt}`, doc_id: docId }, 400)
      }
    }
  }

  // 3) Déplacement dans un dossier Drive
  if (folderId) {
    const moveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docId}?addParents=${encodeURIComponent(folderId)}&removeParents=root&fields=id,parents`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    )
    if (!moveRes.ok) {
      const txt = await moveRes.text()
      // Non bloquant : on retourne quand même le doc créé
      return json({
        doc_id:  docId,
        doc_url: `https://docs.google.com/document/d/${docId}/edit`,
        title:   created.title ?? title,
        warning: `Déplacement dans le dossier impossible : ${txt}`,
      })
    }
  }

  return json({
    doc_id:  docId,
    doc_url: `https://docs.google.com/document/d/${docId}/edit`,
    title:   created.title ?? title,
  })
})
