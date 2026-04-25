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

const DROPBOX_CLIENT_ID = Deno.env.get("DROPBOX_CLIENT_ID") ?? ""
const DROPBOX_CLIENT_SECRET = Deno.env.get("DROPBOX_CLIENT_SECRET") ?? ""
const REDIRECT_URI = "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/dropbox-oauth/callback"
const APP_URL = Deno.env.get("APP_URL") ?? "https://euthymia-zenflow-bento.lovable.app"

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // ── Démarrage du flow OAuth ──
    if (path.endsWith("/authorize")) {
      const userId = url.searchParams.get("user_id")
      if (!userId) {
        return new Response("Missing user_id", { status: 400, headers: corsHeaders })
      }

      const authUrl = new URL("https://www.dropbox.com/oauth2/authorize")
      authUrl.searchParams.set("response_type", "code")
      authUrl.searchParams.set("client_id", DROPBOX_CLIENT_ID)
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI)
      authUrl.searchParams.set("token_access_type", "offline")
      authUrl.searchParams.set("state", userId)
      authUrl.searchParams.set("scope", "files.metadata.read files.content.read files.content.write account_info.read sharing.write")

      return Response.redirect(authUrl.toString(), 302)
    }

    // ── Callback OAuth ──
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    if (!code || !state) {
      return Response.redirect(`${APP_URL}/settings?dropbox_error=missing_code_or_state`, 302)
    }

    // Échange code → tokens
    const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: DROPBOX_CLIENT_ID,
        client_secret: DROPBOX_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenRes.json()
    if (!tokenRes.ok || tokens.error) {
      console.error("Dropbox token error:", tokens)
      return Response.redirect(`${APP_URL}/settings?dropbox_error=${encodeURIComponent(tokens.error_description ?? tokens.error ?? "token_exchange_failed")}`, 302)
    }

    // Profile utilisateur
    let email: string | null = null
    let displayName: string | null = null
    let accountId: string | null = null
    try {
      const profileRes = await fetch("https://api.dropboxapi.com/2/users/get_current_account", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        displayName = profile.name?.display_name ?? null
        email = profile.email ?? null
        accountId = profile.account_id ?? null
      }
    } catch (e) {
      console.warn("Dropbox profile fetch failed:", e)
    }

    const expiry = new Date(Date.now() + (tokens.expires_in ?? 14400) * 1000)

    // Supprime toute connexion existante
    await supabase.from("dropbox_connections").delete().eq("user_id", state)

    const { error: insertError } = await supabase.from("dropbox_connections").insert({
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? "",
      token_expiry: expiry.toISOString(),
      account_id: accountId,
      email,
      display_name: displayName,
    })

    if (insertError) {
      console.error("Dropbox connection insert error:", insertError)
      return Response.redirect(`${APP_URL}/settings?dropbox_error=db_insert_failed`, 302)
    }

    await supabase.from("member_integrations").upsert({
      user_id: state,
      integration: "dropbox",
      is_enabled: true,
      is_connected: true,
      enabled_at: new Date().toISOString(),
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,integration" })

    return Response.redirect(`${APP_URL}/settings?dropbox_connected=true`, 302)
  } catch (err) {
    console.error("Dropbox OAuth error:", err)
    const msg = err instanceof Error ? err.message : "unknown"
    return Response.redirect(`${APP_URL}/settings?dropbox_error=${encodeURIComponent(msg)}`, 302)
  }
})
