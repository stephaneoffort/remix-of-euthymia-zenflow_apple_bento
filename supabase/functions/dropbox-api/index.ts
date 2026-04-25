import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

const DROPBOX_CLIENT_ID = Deno.env.get("DROPBOX_CLIENT_ID") ?? ""
const DROPBOX_CLIENT_SECRET = Deno.env.get("DROPBOX_CLIENT_SECRET") ?? ""

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED")

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace("Bearer ", "")
  const { data, error } = await supabaseUser.auth.getClaims(token)
  if (error || !data?.claims) throw new Error("UNAUTHORIZED")
  return data.claims.sub as string
}

async function getValidToken(userId: string): Promise<string> {
  const { data } = await supabase
    .from("dropbox_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const conn = data as any
  if (!conn) throw new Error("No Dropbox connection found for this user")

  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token
  }

  if (!conn.refresh_token) throw new Error("Dropbox refresh token missing - please reconnect")

  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
      client_id: DROPBOX_CLIENT_ID,
      client_secret: DROPBOX_CLIENT_SECRET,
    }),
  })

  const tokens = await res.json()
  if (!res.ok || tokens.error) {
    throw new Error("Dropbox refresh failed: " + (tokens.error_description ?? tokens.error ?? "unknown"))
  }

  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 14400) * 1000)
  await supabase.from("dropbox_connections").update({
    access_token: tokens.access_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("id", conn.id)

  return tokens.access_token
}

async function dbx(token: string, endpoint: string, body: any): Promise<any> {
  const res = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Dropbox ${endpoint} failed [${res.status}]: ${JSON.stringify(data)}`)
  return data
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    let userId: string
    try {
      userId = await authenticateUser(req)
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const body = await req.json()
    const { action } = body

    // ── Local actions ──
    if (action === "list_attachments") {
      const { entity_type, entity_id } = body
      const { data } = await supabase
        .from("dropbox_attachments")
        .select("*")
        .eq("user_id", userId)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false })
      return new Response(JSON.stringify(data ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "detach") {
      const { attachment_id } = body
      await supabase.from("dropbox_attachments").delete()
        .eq("id", attachment_id).eq("user_id", userId)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // ── Dropbox-API actions ──
    const token = await getValidToken(userId)

    if (action === "list_folder") {
      const path = body.path ?? ""
      const data = await dbx(token, "files/list_folder", {
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false,
        include_has_explicit_shared_members: false,
      })
      return new Response(JSON.stringify(data.entries ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "search") {
      const { query } = body
      const data = await dbx(token, "files/search_v2", {
        query: query ?? "",
        options: { max_results: 50 },
      })
      const entries = (data.matches ?? []).map((m: any) => m.metadata?.metadata).filter(Boolean)
      return new Response(JSON.stringify(entries), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "attach") {
      const { entity_type, entity_id, file } = body
      // file = entry from list_folder/search { ".tag", id, name, path_display, size, ... }
      const isFolder = file[".tag"] === "folder"

      // Create or get a shared link
      let fileUrl: string | null = null
      try {
        const link = await dbx(token, "sharing/create_shared_link_with_settings", {
          path: file.path_lower ?? file.path_display,
          settings: { audience: "public", access: "viewer", allow_download: true },
        })
        fileUrl = link.url
      } catch (e: any) {
        // Already exists -> list it
        try {
          const existing = await dbx(token, "sharing/list_shared_links", {
            path: file.path_lower ?? file.path_display,
            direct_only: true,
          })
          fileUrl = existing.links?.[0]?.url ?? null
        } catch {
          console.warn("shared link fallback failed", e)
        }
      }

      // Try to fetch a thumbnail (only for files, supported image/doc types)
      let thumbnailUrl: string | null = null
      if (!isFolder && /\.(jpg|jpeg|png|gif|bmp|tiff|webp|pdf)$/i.test(file.name)) {
        try {
          const thumbRes = await fetch("https://content.dropboxapi.com/2/files/get_thumbnail_v2", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Dropbox-API-Arg": JSON.stringify({
                resource: { ".tag": "path", path: file.path_lower ?? file.path_display },
                format: "jpeg",
                size: "w256h256",
              }),
            },
          })
          if (thumbRes.ok) {
            const blob = await thumbRes.arrayBuffer()
            const b64 = btoa(String.fromCharCode(...new Uint8Array(blob)))
            thumbnailUrl = `data:image/jpeg;base64,${b64}`
          }
        } catch (e) {
          console.warn("thumbnail fetch failed", e)
        }
      }

      const { data, error } = await supabase
        .from("dropbox_attachments")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          file_id: file.id,
          file_name: file.name,
          file_path: file.path_display ?? file.path_lower ?? "",
          file_url: fileUrl,
          mime_type: isFolder ? "folder" : null,
          file_size: file.size ?? null,
          is_folder: isFolder,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "create_folder") {
      const { path } = body
      const data = await dbx(token, "files/create_folder_v2", {
        path,
        autorename: true,
      })
      return new Response(JSON.stringify(data.metadata), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "profile") {
      const data = await dbx(token, "users/get_current_account", null as any)
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err) {
    console.error("Dropbox API error:", err)
    const msg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
