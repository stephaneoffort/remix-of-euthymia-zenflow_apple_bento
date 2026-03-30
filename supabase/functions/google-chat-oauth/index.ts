import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

const REDIRECT_URI = "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-chat-oauth/callback"
const APP_URL = "https://euthymia-zenflow-bento.lovable.app"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  // ── AUTHORIZE ────────────────────────────────────────
  if (path.endsWith("/authorize")) {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "")
      ?? url.searchParams.get("token") ?? ""

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }

    const state = btoa(JSON.stringify({
      user_id: user.id,
      nonce: crypto.randomUUID()
    }))

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", Deno.env.get("GOOGLE_CLIENT_ID") ?? "")
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", [
      "https://www.googleapis.com/auth/chat.messages.readonly",
      "https://www.googleapis.com/auth/chat.spaces.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" "))
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", state)

    return Response.redirect(authUrl.toString(), 302)
  }

  // ── CALLBACK ─────────────────────────────────────────
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
      return new Response("Missing user_id", { status: 400, headers: corsHeaders })
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      return new Response(`OAuth error: ${tokens.error}`, { status: 400, headers: corsHeaders })
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const profile = await profileRes.json()
    const expiry = new Date(Date.now() + tokens.expires_in * 1000)

    await supabase.from("google_chat_connections").upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry.toISOString(),
      email: profile.email,
    }, { onConflict: "user_id" })

    await supabase.from("member_integrations").update({
      is_connected: true,
      is_enabled: true,
      connected_at: new Date().toISOString(),
      enabled_at: new Date().toISOString(),
    })
      .eq("user_id", userId)
      .eq("integration", "google_chat")

    return Response.redirect(APP_URL + "/settings?google_chat_connected=true", 302)
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
})
