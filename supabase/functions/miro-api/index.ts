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

const MIRO_CLIENT_ID = Deno.env.get("MIRO_CLIENT_ID") ?? ""
const MIRO_CLIENT_SECRET = Deno.env.get("MIRO_CLIENT_SECRET") ?? ""

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace("Bearer ", "")
  const { data, error } = await supabaseUser.auth.getClaims(token)
  if (error || !data?.claims) {
    throw new Error("UNAUTHORIZED")
  }

  return data.claims.sub as string
}

async function getValidToken(userId: string): Promise<string> {
  const { data } = await supabase
    .from("miro_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const conn = data as any
  if (!conn) throw new Error("No Miro connection found for this user")

  // Token still valid (5 min buffer)
  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token
  }

  // Refresh
  if (!conn.refresh_token) throw new Error("Miro refresh token missing - please reconnect")

  const res = await fetch("https://api.miro.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: MIRO_CLIENT_ID,
      client_secret: MIRO_CLIENT_SECRET,
      refresh_token: conn.refresh_token,
    }),
  })

  const tokens = await res.json()
  if (!res.ok || tokens.error) {
    throw new Error("Miro refresh failed: " + (tokens.error_description ?? tokens.error ?? "unknown"))
  }

  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000)
  await supabase.from("miro_connections").update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? conn.refresh_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("id", conn.id)

  return tokens.access_token
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

    // ── Actions purement locales ──
    if (action === "list_attachments") {
      const { entity_type, entity_id } = body
      const { data } = await supabase
        .from("miro_attachments")
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
      await supabase.from("miro_attachments").delete()
        .eq("id", attachment_id).eq("user_id", userId)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // ── Actions nécessitant un token Miro ──
    const token = await getValidToken(userId)
    const miroHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    if (action === "list_boards") {
      const query = body.query ? `&query=${encodeURIComponent(body.query)}` : ""
      const res = await fetch(`https://api.miro.com/v2/boards?limit=50${query}`, { headers: miroHeaders })
      const data = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message ?? "Miro list_boards failed", details: data }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      return new Response(JSON.stringify(data.data ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "create_board") {
      const { name, description } = body
      const res = await fetch("https://api.miro.com/v2/boards", {
        method: "POST",
        headers: miroHeaders,
        body: JSON.stringify({
          name: name ?? "Nouveau board Euthymia",
          description: description ?? "",
          policy: {
            permissionsPolicy: { collaborationToolsStartAccess: "all_editors", copyAccess: "team_editors", sharingAccess: "team_members_with_editing_rights" },
            sharingPolicy: { access: "private", inviteToAccountAndBoardLinkAccess: "no_access", organizationAccess: "private", teamAccess: "private" },
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message ?? "Miro create_board failed", details: data }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "attach") {
      const { board_id, entity_type, entity_id } = body

      // Récupère les infos du board
      const res = await fetch(`https://api.miro.com/v2/boards/${board_id}`, { headers: miroHeaders })
      const board = await res.json()
      if (!res.ok) {
        return new Response(JSON.stringify({ error: board.message ?? "Miro board fetch failed" }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }

      const { data, error } = await supabase
        .from("miro_attachments")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          board_id: board.id,
          board_name: board.name ?? "Board Miro",
          board_url: board.viewLink ?? `https://miro.com/app/board/${board.id}/`,
          thumbnail_url: board.picture?.imageURL ?? null,
          board_description: board.description ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    if (action === "profile") {
      const res = await fetch("https://api.miro.com/v2/users/me", { headers: miroHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error("Miro API error:", err)
    const msg = err instanceof Error ? err.message : "Unknown error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
