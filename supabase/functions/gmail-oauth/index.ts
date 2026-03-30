import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? ""
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? ""
  const GMAIL_REDIRECT_URI = Deno.env.get("GMAIL_REDIRECT_URI") ?? ""

  if (path.endsWith("/authorize")) {
    const token = url.searchParams.get("token") || ""

    // Validate the token to get the user id
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    )
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders })
    }

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", GMAIL_REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile")
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    authUrl.searchParams.set("state", user.id)

    return Response.redirect(authUrl.toString(), 302)
  }

  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code")
    const userId = url.searchParams.get("state") || null

    if (!code || !userId) {
      return new Response("Missing code or state", { status: 400, headers: corsHeaders })
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GMAIL_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      console.error("Gmail OAuth error:", tokens)
      return new Response(`OAuth error: ${tokens.error_description || tokens.error}`, {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Get user profile
    let email = null
    let displayName = null
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      const profile = await profileRes.json()
      email = profile.email
      displayName = profile.name
    } catch (e) {
      console.error("Failed to fetch Gmail profile:", e)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const expiry = new Date(Date.now() + tokens.expires_in * 1000)

    // Upsert gmail connection
    const { error: upsertError } = await supabase
      .from("gmail_connections")
      .upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry.toISOString(),
        email,
        display_name: displayName,
      }, { onConflict: "user_id" })

    if (upsertError) {
      console.error("Gmail upsert error:", upsertError)
      // Try insert if upsert fails (no unique constraint yet)
      await supabase.from("gmail_connections").delete().eq("user_id", userId)
      await supabase.from("gmail_connections").insert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry.toISOString(),
        email,
        display_name: displayName,
      })
    }

    // Auto-enable gmail integration
    await supabase
      .from("member_integrations")
      .update({
        is_enabled: true,
        is_connected: true,
        enabled_at: new Date().toISOString(),
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("integration", "gmail")

    const appUrl = Deno.env.get("APP_URL") ?? ""
    return Response.redirect(`${appUrl}/settings?gmail_connected=true`, 302)
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
})