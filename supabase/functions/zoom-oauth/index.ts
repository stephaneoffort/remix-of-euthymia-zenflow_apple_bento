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

const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID") ?? ""
const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET") ?? ""
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/zoom-oauth/callback`
const APP_URL = Deno.env.get("APP_URL") ?? "https://euthymia-zenflow-bento.lovable.app"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  // ── Authorize ──
  if (path.endsWith("/authorize")) {
    const token = url.searchParams.get("token") ?? ""

    // Validate JWT to get user_id
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data, error } = await supabaseUser.auth.getClaims(token)
    const userId = data?.claims?.sub as string ?? ""

    if (!userId) {
      return new Response("Unauthorized — invalid token", { status: 401, headers: corsHeaders })
    }

    const state = btoa(JSON.stringify({
      user_id: userId,
      nonce: crypto.randomUUID(),
    }))

    const authUrl = new URL("https://zoom.us/oauth/authorize")
    authUrl.searchParams.set("client_id", ZOOM_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("state", state)

    return Response.redirect(authUrl.toString(), 302)
  }

  // ── Callback ──
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code")
    const stateParam = url.searchParams.get("state") ?? ""

    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders })
    }

    let userId = ""
    try {
      const decoded = JSON.parse(atob(stateParam))
      userId = decoded.user_id
    } catch {
      return new Response("Invalid state", { status: 400, headers: corsHeaders })
    }

    if (!userId) {
      return new Response("Missing user_id in state", { status: 400, headers: corsHeaders })
    }

    // Exchange code for tokens
    const credentials = btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`)
    const tokenRes = await fetch("https://zoom.us/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      return new Response(`Zoom OAuth error: ${tokens.error}`, { status: 400, headers: corsHeaders })
    }

    // Get Zoom profile
    const profileRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const expiry = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert connection — isolated by user_id
    await supabase.from("zoom_connections").upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry.toISOString(),
      zoom_user_id: profile.id ?? null,
      email: profile.email ?? null,
      display_name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Zoom User",
    }, { onConflict: "user_id" })

    return Response.redirect(APP_URL + "?zoom_connected=true", 302)
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
})
