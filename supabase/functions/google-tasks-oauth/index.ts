import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REDIRECT_URI =
  Deno.env.get("SUPABASE_URL") +
  "/functions/v1/google-tasks-oauth/callback";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // ── Authorize ──
  if (path.endsWith("/authorize")) {
    const userId = url.searchParams.get("user_id") || "";
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", Deno.env.get("GOOGLE_CLIENT_ID") ?? "");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", [
      "https://www.googleapis.com/auth/tasks",
      "email",
      "profile",
    ].join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", userId);
    return Response.redirect(authUrl.toString(), 302);
  }

  // ── Callback ──
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state") || null;
    const error = url.searchParams.get("error");
    const appUrl = Deno.env.get("APP_URL") ?? "";

    if (error) {
      return Response.redirect(`${appUrl}/settings?tasks_error=${encodeURIComponent(error)}`, 302);
    }
    if (!code) {
      return Response.redirect(`${appUrl}/settings?tasks_error=missing_code`, 302);
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
    });
    const tokens = await tokenRes.json();
    if (tokens.error) {
      return Response.redirect(`${appUrl}/settings?tasks_error=${encodeURIComponent(tokens.error)}`, 302);
    }

    // Fetch user profile (email + display name)
    let email: string | null = null;
    let displayName: string | null = null;
    try {
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      email = profile.email ?? null;
      displayName = profile.name ?? null;
    } catch { /* ignore */ }

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    if (userId) {
      await supabase.from("google_tasks_connections").delete().eq("user_id", userId);
    }

    await supabase.from("google_tasks_connections").insert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: expiry,
      email,
      display_name: displayName,
    });

    // Mark integration as connected in member_integrations
    if (userId) {
      await supabase.from("member_integrations").upsert(
        {
          user_id: userId,
          integration: "google_tasks",
          is_connected: true,
          is_enabled: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,integration" },
      );
    }

    return Response.redirect(`${appUrl}/settings?tasks_connected=true`, 302);
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
