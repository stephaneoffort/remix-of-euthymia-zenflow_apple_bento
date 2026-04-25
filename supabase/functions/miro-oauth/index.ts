import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

const MIRO_CLIENT_ID = Deno.env.get("MIRO_CLIENT_ID") ?? ""
const MIRO_CLIENT_SECRET = Deno.env.get("MIRO_CLIENT_SECRET") ?? ""
// Doit correspondre exactement à la Redirect URI configurée dans l'app Miro
const REDIRECT_URI = Deno.env.get("MIRO_REDIRECT_URI") ?? "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/miro-oauth"
const APP_URL = Deno.env.get("APP_URL") ?? "https://euthymia-zenflow-bento.lovable.app"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state") // contient user_id

    // ── Démarrage du flow OAuth (pas de code) ──
    if (!code) {
      const userId = url.searchParams.get("user_id")
      if (!userId) {
        return new Response("Missing user_id", { status: 400, headers: corsHeaders })
      }

      const authUrl = new URL("https://miro.com/oauth/authorize")
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("client_id", MIRO_CLIENT_ID)
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
      authUrl.searchParams.set("state", userId)

      return Response.redirect(authUrl.toString(), 302)
    }

    // ── Callback OAuth (avec code) ──
    if (!state) {
      return new Response("Missing state", { status: 400, headers: corsHeaders })
    }

    // Échange code → tokens
    const tokenRes = await fetch("https://api.miro.com/v1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: MIRO_CLIENT_ID,
        client_secret: MIRO_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok || tokens.error) {
      console.error("Miro token error:", tokens)
      return Response.redirect(`${APP_URL}?miro_error=${encodeURIComponent(tokens.error_description ?? tokens.error ?? "token_exchange_failed")}`, 302)
    }

    // Profile utilisateur
    let email: string | null = null
    let displayName: string | null = null
    try {
      const profileRes = await fetch("https://api.miro.com/v2/users/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        displayName = profile.name ?? profile.displayName ?? null
        email = profile.email ?? null
      }
    } catch (e) {
      console.warn("Miro profile fetch failed:", e)
    }

    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000)

    // Supprime toute connexion existante pour cet user
    await supabase.from("miro_connections").delete().eq("user_id", state)

    // Insère la nouvelle connexion
    const { error: insertError } = await supabase.from("miro_connections").insert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? "",
      token_expiry: expiry.toISOString(),
      email,
      display_name: displayName,
      team_id: tokens.team_id ?? null,
      team_name: tokens.team_name ?? null,
    })

    if (insertError) {
      console.error("Miro connection insert error:", insertError)
      return Response.redirect(`${APP_URL}?miro_error=db_insert_failed`, 302)
    }

    // Mark integration as connected
    await supabase.from("member_integrations").upsert({
      user_id: state,
      integration: "miro",
      is_enabled: true,
      is_connected: true,
      enabled_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,integration" })

    return Response.redirect(`${APP_URL}/settings?miro_connected=true`, 302)
  } catch (err) {
    console.error("Miro OAuth error:", err)
    const msg = err instanceof Error ? err.message : "unknown"
    return Response.redirect(`${APP_URL}?miro_error=${encodeURIComponent(msg)}`, 302)
  }
})
