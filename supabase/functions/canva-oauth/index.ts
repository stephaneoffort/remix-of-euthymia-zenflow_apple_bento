import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
const supabase = createClient(supabaseUrl, supabaseKey)

const CANVA_CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID") ?? ""
const CANVA_CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET") ?? ""
const REDIRECT_URI = "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/canva-oauth/callback"
const APP_URL = Deno.env.get("APP_URL") ?? "https://euthymia-zenflow-bento.lovable.app"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  // ── Authorize ──
  if (path.endsWith("/authorize")) {
    const userId = url.searchParams.get("user_id") || ""
    const state = crypto.randomUUID()
    const codeVerifier = crypto.randomUUID() + crypto.randomUUID()

    // PKCE
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hashBuffer = await crypto.subtle.digest("SHA-256", data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const base64 = btoa(String.fromCharCode(...hashArray))
    const codeChallenge = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

    // Store code_verifier temporarily
    await supabase.from("canva_connections").upsert({
      access_token: "pending",
      refresh_token: codeVerifier,
      token_expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      email: `pending_${state}`,
      display_name: userId,
    }, { onConflict: "email" })

    const authUrl = new URL("https://www.canva.com/api/oauth/authorize")
    authUrl.searchParams.set("client_id", CANVA_CLIENT_ID)
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", [
      "asset:read", "asset:write",
      "design:content:read", "design:content:write",
      "design:meta:read", "profile:read",
    ].join(" "))
    authUrl.searchParams.set("state", state)
    authUrl.searchParams.set("code_challenge", codeChallenge)
    authUrl.searchParams.set("code_challenge_method", "S256")

    return Response.redirect(authUrl.toString(), 302)
  }

  // ── Callback ──
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders })
    }

    const { data: pending } = await supabase
      .from("canva_connections")
      .select("refresh_token, display_name")
      .eq("email", `pending_${state}`)
      .single()

    const codeVerifier = pending?.refresh_token ?? ""
    const userId = pending?.display_name ?? ""

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${CANVA_CLIENT_ID}:${CANVA_CLIENT_SECRET}`),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      return new Response(`Canva OAuth error: ${tokens.error}`, { status: 400, headers: corsHeaders })
    }

    // Get user profile
    const profileRes = await fetch("https://api.canva.com/rest/v1/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    const expiry = new Date(Date.now() + tokens.expires_in * 1000)

    // Delete pending entry and create real connection
    await supabase.from("canva_connections").delete().eq("email", `pending_${state}`)

    await supabase.from("canva_connections").upsert({
      user_id: userId || null,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry.toISOString(),
      email: profile.profile?.email ?? `canva_${crypto.randomUUID().slice(0, 8)}`,
      display_name: profile.profile?.display_name ?? "Canva User",
    }, { onConflict: "email" })

    return Response.redirect(APP_URL + "?canva_connected=true", 302)
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
})
