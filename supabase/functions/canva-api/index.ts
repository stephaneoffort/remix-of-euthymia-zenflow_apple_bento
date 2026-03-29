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

const CANVA_CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID") ?? ""
const CANVA_CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET") ?? ""

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
    .from("canva_connections")
    .select("*")
    .eq("user_id", userId)
    .not("email", "like", "pending_%")
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  const conn = data as any
  if (!conn) throw new Error("No Canva connection found for this user")

  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token
  }

  // Refresh
  const res = await fetch("https://api.canva.com/rest/v1/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  })

  const tokens = await res.json()
  if (tokens.error) throw new Error("Canva refresh failed: " + tokens.error)

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000)
  await supabase.from("canva_connections").update({
    access_token: tokens.access_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("id", conn.id)

  return tokens.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Authenticate user via JWT
    let userId: string
    try {
      userId = await authenticateUser(req)
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const body = await req.json()
    const { action } = body
    const token = await getValidToken(userId)

    const canvaHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }

    if (action === "list_designs") {
      const res = await fetch("https://api.canva.com/rest/v1/designs?limit=20", { headers: canvaHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data.items ?? []), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "search_designs") {
      const { query } = body
      const res = await fetch(`https://api.canva.com/rest/v1/designs?query=${encodeURIComponent(query)}&limit=20`, { headers: canvaHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data.items ?? []), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "create_design") {
      const { design_type, title } = body
      const res = await fetch("https://api.canva.com/rest/v1/designs", {
        method: "POST",
        headers: canvaHeaders,
        body: JSON.stringify({
          design_type: { type: design_type ?? "doc" },
          title: title ?? "Nouveau design Euthymia",
        }),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "attach") {
      const { design_id, entity_type, entity_id } = body
      const res = await fetch(`https://api.canva.com/rest/v1/designs/${design_id}`, { headers: canvaHeaders })
      const design = await res.json()

      const { data, error } = await supabase
        .from("canva_attachments")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          design_id: design.id ?? design_id,
          design_name: design.title ?? "Design Canva",
          design_url: design.urls?.edit_url ?? design.urls?.view_url ?? "",
          thumbnail_url: design.thumbnail?.url ?? null,
          design_type: design.design_type?.type ?? null,
        })
        .select()
        .single()

      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "list_attachments") {
      const { entity_type, entity_id } = body
      const { data } = await supabase
        .from("canva_attachments")
        .select("*")
        .eq("user_id", userId)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false })
      return new Response(JSON.stringify(data ?? []), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "detach") {
      const { attachment_id } = body
      await supabase.from("canva_attachments").delete().eq("id", attachment_id).eq("user_id", userId)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "export") {
      const { design_id, format } = body
      const res = await fetch("https://api.canva.com/rest/v1/exports", {
        method: "POST",
        headers: canvaHeaders,
        body: JSON.stringify({
          design_id,
          format: { type: format ?? "png", export_quality: "regular" },
        }),
      })
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    if (action === "profile") {
      const res = await fetch("https://api.canva.com/rest/v1/users/me", { headers: canvaHeaders })
      const data = await res.json()
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders })
  } catch (err) {
    console.error("Canva API error:", err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})