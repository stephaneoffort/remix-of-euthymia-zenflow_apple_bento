import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const MIRO_CLIENT_ID = Deno.env.get("MIRO_CLIENT_ID") ?? "";
const MIRO_CLIENT_SECRET = Deno.env.get("MIRO_CLIENT_SECRET") ?? "";
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")}/functions/v1/miro-oauth/callback`;
const APP_URL = Deno.env.get("APP_URL") ?? "https://euthymia-zenflow-bento.lovable.app";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // ── Authorize ──
  if (path.endsWith("/authorize")) {
    const token = url.searchParams.get("token") ?? "";

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data } = await supabaseUser.auth.getClaims(token);
    const userId = (data?.claims?.sub as string) ?? "";

    if (!userId) {
      return new Response("Unauthorized — invalid token", { status: 401, headers: corsHeaders });
    }

    const state = btoa(JSON.stringify({ user_id: userId, nonce: crypto.randomUUID() }));

    const authUrl = new URL("https://miro.com/oauth/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", MIRO_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString(), 302);
  }

  // ── Callback ──
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
      return new Response("Missing user_id in state", { status: 400, headers: corsHeaders });
    }

    // Exchange code for tokens
    const credentials = btoa(`${MIRO_CLIENT_ID}:${MIRO_CLIENT_SECRET}`);
    const tokenRes = await fetch("https://api.miro.com/v1/oauth/token", {
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
    });

    const tokens = await tokenRes.json();
    if (tokens.status === 400 || tokens.message) {
      return new Response(`Miro OAuth error: ${tokens.message ?? "unknown"}`, {
        status: 400,
        headers: corsHeaders,
      });
    }

    // Get Miro user profile
    const profileRes = await fetch("https://api.miro.com/v2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const expiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(); // Miro tokens are long-lived

    await supabase.from("miro_connections").upsert(
      {
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expiry: expiry,
        miro_user_id: profile.id ?? null,
        email: profile.email ?? null,
        display_name: profile.name ?? "Miro User",
      },
      { onConflict: "user_id" },
    );

    return Response.redirect(`${APP_URL}?miro_connected=true`, 302);
  }

  return new Response("Not found", { status: 404, headers: corsHeaders });
});
