import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const clientId = Deno.env.get("OUTLOOK_CLIENT_ID") ?? "";
  const clientSecret = Deno.env.get("OUTLOOK_CLIENT_SECRET") ?? "";
  const tenantId = Deno.env.get("OUTLOOK_TENANT_ID") ?? "common";
  const redirectUri = Deno.env.get("OUTLOOK_REDIRECT_URI") ?? "";

  // ─── AUTHORIZE ───
  if (path.endsWith("/authorize")) {
    const userId = url.searchParams.get("user_id") || "";
    const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "Calendars.ReadWrite offline_access User.Read");
    authUrl.searchParams.set("response_mode", "query");
    authUrl.searchParams.set("state", userId);
    authUrl.searchParams.set("prompt", "consent");
    return Response.redirect(authUrl.toString(), 302);
  }

  // ─── CALLBACK ───
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state") || null;
    const error = url.searchParams.get("error");

    if (error) {
      return new Response(`OAuth error: ${error} - ${url.searchParams.get("error_description")}`, {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!code) {
      return new Response("Missing code", { status: 400, headers: corsHeaders });
    }

    // Exchange code for tokens
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: "Calendars.ReadWrite offline_access User.Read",
        }),
      },
    );

    const tokens = await tokenRes.json();
    if (tokens.error) {
      return new Response(`Token error: ${tokens.error} - ${tokens.error_description}`, {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const expiry = new Date(Date.now() + tokens.expires_in * 1000);

    // Fetch user profile for label
    let label = "Outlook Calendar";
    try {
      const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      if (profile.displayName) label = `Outlook — ${profile.displayName}`;
      else if (profile.mail) label = `Outlook — ${profile.mail}`;
    } catch {
      // Keep default label
    }

    // Insert calendar account
    await supabase.from("calendar_accounts").insert({
      provider: "outlook",
      label,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: expiry.toISOString(),
      is_active: true,
      user_id: userId,
      color: "#0078D4",
    });

    const appUrl = Deno.env.get("APP_URL") ?? "";
    return Response.redirect(appUrl + "?connected=outlook", 302);
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
