// supabase/functions/figma-api/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const FIGMA_CLIENT_ID      = Deno.env.get("FIGMA_CLIENT_ID") ?? ""
const FIGMA_CLIENT_SECRET  = Deno.env.get("FIGMA_CLIENT_SECRET") ?? ""

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function parseFigmaUrl(input: string): { fileKey: string; nodeId: string | null } | null {
  const v = input.trim()
  if (!v) return null

  // Direct file key (≥ 15 char alphanum)
  if (/^[a-zA-Z0-9]{15,}$/.test(v)) return { fileKey: v, nodeId: null }

  try {
    const u = new URL(v)
    if (!u.hostname.includes("figma.com")) return null
    // /file/{key}/...  or  /design/{key}/...  or  /proto/{key}/...
    const m = u.pathname.match(/\/(?:file|design|proto)\/([a-zA-Z0-9]+)/)
    if (!m) return null
    let nodeId = u.searchParams.get("node-id")
    if (nodeId) nodeId = nodeId.replace(/-/g, ":")
    return { fileKey: m[1], nodeId }
  } catch {
    return null
  }
}

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token)
  return user
}

async function refreshFigmaToken(refreshToken: string) {
  const res = await fetch("https://api.figma.com/v1/oauth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     FIGMA_CLIENT_ID,
      client_secret: FIGMA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) return null
  return await res.json() as { access_token: string; expires_in: number }
}

async function getValidAccessToken(db: any, userId: string) {
  const { data: conn } = await db
    .from("figma_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()
  if (!conn) return null

  const expired = conn.token_expiry && new Date(conn.token_expiry).getTime() < Date.now() + 60_000
  if (!expired) return conn.access_token as string

  if (!conn.refresh_token) return conn.access_token as string
  const refreshed = await refreshFigmaToken(conn.refresh_token)
  if (!refreshed) return conn.access_token as string

  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  await db.from("figma_connections")
    .update({ access_token: refreshed.access_token, token_expiry: newExpiry })
    .eq("id", conn.id)
  return refreshed.access_token
}

async function figmaFetch(path: string, accessToken: string) {
  const res = await fetch(`https://api.figma.com${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return res
}

// ────────────────────────────────────────────────────────────────────────────
// Preview fetching
// ────────────────────────────────────────────────────────────────────────────

async function fetchFilePreview(accessToken: string, fileKey: string, nodeId: string | null) {
  // Fichier metadata (titre, last_modified, thumbnail global)
  const metaRes = await figmaFetch(`/v1/files/${fileKey}?depth=1`, accessToken)
  if (!metaRes.ok) {
    return { ok: false as const, status: metaRes.status, error: await metaRes.text() }
  }
  const meta = await metaRes.json() as {
    name: string
    thumbnailUrl?: string
    lastModified?: string
  }

  let previewImageUrl: string | null = null
  if (nodeId) {
    const imgRes = await figmaFetch(
      `/v1/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=1`,
      accessToken,
    )
    if (imgRes.ok) {
      const j = await imgRes.json() as { images?: Record<string, string | null> }
      previewImageUrl = j.images?.[nodeId] ?? null
    }
  }

  return {
    ok: true as const,
    file_name: meta.name,
    thumbnail_url: meta.thumbnailUrl ?? null,
    preview_image_url: previewImageUrl ?? meta.thumbnailUrl ?? null,
    last_modified: meta.lastModified ?? null,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Server
// ────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  try {
    const user = await getUser(req)
    if (!user) return json({ error: "unauthorized" }, 401)

    const body = await req.json().catch(() => ({}))
    const action = body?.action as string | undefined
    if (!action) return json({ error: "missing_action" }, 400)

    const db: any = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── disconnect ─────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await db.from("figma_connections").delete().eq("user_id", user.id)
      await db.from("member_integrations")
        .update({
          is_connected: false,
          is_enabled:   false,
          connected_at: null,
          updated_at:   new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("integration", "figma")
      return json({ ok: true })
    }

    // ── list_links (par tâche) ────────────────────────────────────────────
    if (action === "list_links") {
      const taskIds = body?.task_ids as string[] | undefined
      if (!Array.isArray(taskIds) || taskIds.length === 0) return json({ links: [] })
      const { data } = await db
        .from("figma_links")
        .select("*")
        .eq("user_id", user.id)
        .in("task_id", taskIds)
        .order("created_at", { ascending: false })
      return json({ links: data ?? [] })
    }

    // ── recent_files (picker) ─────────────────────────────────────────────
    // Figma n'expose pas un endpoint "recent files" public. On retourne
    // les projets liés récemment par l'utilisateur dans figma_links comme
    // suggestions (best effort), sans appeler l'API Figma.
    if (action === "recent_files") {
      const { data } = await db
        .from("figma_links")
        .select("file_key, file_name, thumbnail_url, last_modified")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20)
      // Dédoublonne par file_key
      const seen = new Set<string>()
      const uniques = (data ?? []).filter((d: any) => {
        if (seen.has(d.file_key)) return false
        seen.add(d.file_key)
        return true
      })
      return json({ files: uniques })
    }

    // ── link_file ─────────────────────────────────────────────────────────
    if (action === "link_file") {
      const taskId = body?.task_id as string
      const input  = body?.input as string
      if (!taskId || !input) return json({ error: "missing_params" }, 400)

      const parsed = parseFigmaUrl(input)
      if (!parsed) return json({ error: "Lien Figma invalide." }, 400)

      const accessToken = await getValidAccessToken(db, user.id)
      if (!accessToken) return json({ error: "not_connected" }, 400)

      const preview = await fetchFilePreview(accessToken, parsed.fileKey, parsed.nodeId)
      if (!preview.ok) {
        return json(
          { error: `Figma API a refusé l'accès (${preview.status}). Vérifie que tu as accès à ce fichier.` },
          400,
        )
      }

      const { data: inserted, error: insErr } = await db
        .from("figma_links")
        .insert({
          task_id:           taskId,
          user_id:           user.id,
          file_key:          parsed.fileKey,
          node_id:           parsed.nodeId,
          file_name:         preview.file_name,
          thumbnail_url:     preview.thumbnail_url,
          preview_image_url: preview.preview_image_url,
          last_modified:     preview.last_modified,
        })
        .select()
        .single()

      if (insErr) return json({ error: insErr.message }, 500)
      return json({ link: inserted })
    }

    // ── refresh_preview ───────────────────────────────────────────────────
    if (action === "refresh_preview") {
      const linkId = body?.link_id as string
      if (!linkId) return json({ error: "missing_link_id" }, 400)

      const { data: link } = await db
        .from("figma_links")
        .select("*")
        .eq("id", linkId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (!link) return json({ error: "not_found" }, 404)

      const accessToken = await getValidAccessToken(db, user.id)
      if (!accessToken) return json({ error: "not_connected" }, 400)

      const preview = await fetchFilePreview(accessToken, link.file_key, link.node_id)
      if (!preview.ok) return json({ error: `Figma API ${preview.status}` }, 400)

      const { data: updated, error: upErr } = await db
        .from("figma_links")
        .update({
          file_name:         preview.file_name,
          thumbnail_url:     preview.thumbnail_url,
          preview_image_url: preview.preview_image_url,
          last_modified:     preview.last_modified,
        })
        .eq("id", linkId)
        .select()
        .single()

      if (upErr) return json({ error: upErr.message }, 500)
      return json({ link: updated })
    }

    // ── unlink ────────────────────────────────────────────────────────────
    if (action === "unlink") {
      const linkId = body?.link_id as string
      if (!linkId) return json({ error: "missing_link_id" }, 400)
      await db.from("figma_links").delete().eq("id", linkId).eq("user_id", user.id)
      return json({ ok: true })
    }

    return json({ error: `unknown_action:${action}` }, 400)
  } catch (e) {
    console.error("[figma-api] ", e)
    return json({ error: (e as Error).message }, 500)
  }
})
