// Multi-account Gmail OAuth — writes to email_accounts (not gmail_connections)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const REDIRECT_URI =
  "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/gmail-account-oauth/callback";
const APP_URL = "https://euthymia-zenflow-bento.lovable.app";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith("/authorize")) {
    const token =
      req.headers.get("Authorization")?.replace("Bearer ", "") ??
      url.searchParams.get("token") ??
      "";

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const state = btoa(
      JSON.stringify({ user_id: user.id, nonce: crypto.randomUUID() })
    );

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", Deno.env.get("GOOGLE_CLIENT_ID") ?? "");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ].join(" ")
    );
    authUrl.searchParams.set("access_type", "offline");
    // Force account chooser + consent so user can pick a different Google account
    authUrl.searchParams.set("prompt", "select_account consent");
    authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString(), 302);
  }

  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state") ?? "";

    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders });
    }

    let userId = "";
    try {
      const decoded = JSON.parse(atob(stateParam));
      userId = decoded.user_id;
    } catch {
      return new Response("Invalid state", { status: 400, headers: corsHeaders });
    }
    if (!userId) {
      return new Response("Missing user_id", { status: 400, headers: corsHeaders });
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
      return Response.redirect(
        `${APP_URL}?email_oauth_error=${encodeURIComponent(tokens.error)}`,
        302
      );
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const profile = await profileRes.json();
    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Find any existing row for this user + email (case-insensitive match handled by unique idx)
    const { data: existing } = await supabaseAdmin
      .from("email_accounts")
      .select("id, oauth_refresh_token")
      .eq("user_id", userId)
      .ilike("email_address", profile.email)
      .maybeSingle();

    const refresh =
      tokens.refresh_token ?? existing?.oauth_refresh_token ?? null;

    if (existing) {
      await supabaseAdmin
        .from("email_accounts")
        .update({
          account_type: "gmail",
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: refresh,
          oauth_token_expiry: expiry.toISOString(),
          oauth_external_user_id: profile.id ?? null,
          display_name: profile.name ?? profile.email,
          is_active: true,
          last_sync_error: null,
        })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("email_accounts").insert({
        user_id: userId,
        account_type: "gmail",
        email_address: profile.email,
        display_name: profile.name ?? profile.email,
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: refresh,
        oauth_token_expiry: expiry.toISOString(),
        oauth_external_user_id: profile.id ?? null,
      });
    }

    return Response.redirect(`${APP_URL}?email_gmail_added=1`, 302);
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
