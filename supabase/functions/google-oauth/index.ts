import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const path = url.pathname

  if (path.endsWith("/authorize")) {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    authUrl.searchParams.set("client_id", Deno.env.get("GOOGLE_CLIENT_ID") ?? "")
    authUrl.searchParams.set("redirect_uri", Deno.env.get("GOOGLE_REDIRECT_URI") ?? "")
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events")
    authUrl.searchParams.set("access_type", "offline")
    authUrl.searchParams.set("prompt", "consent")
    return Response.redirect(authUrl.toString(), 302)
  }

  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code")
    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders })
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
        redirect_uri: Deno.env.get("GOOGLE_REDIRECT_URI") ?? "",
        grant_type: "authorization_code",
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      return new Response(`OAuth error: ${tokens.error}`, {
        status: 400, headers: corsHeaders
      })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const expiry = new Date(Date.now() + tokens.expires_in * 1000)

    // Récupérer la liste de tous les calendriers
    const calListRes = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    )
    const calList = await calListRes.json()
    const calendars = calList.items ?? []

    // Insérer un calendar_account par calendrier
    for (const cal of calendars) {
      await supabase.from("calendar_accounts").upsert({
        provider: "google",
        label: cal.summary,
        calendar_id: cal.id,
        color: cal.backgroundColor ?? "#4285f4",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry.toISOString(),
        is_active: true,
      }, { onConflict: "calendar_id" })
    }

    const appUrl = Deno.env.get("APP_URL") ?? ""
    return Response.redirect(appUrl + "?connected=true", 302)
  }

  return new Response("Not found", { status: 404, headers: corsHeaders })
})
