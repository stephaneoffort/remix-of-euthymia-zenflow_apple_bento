import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// @ts-ignore
Deno.serve({ verify: false }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // ── Route 1: /google-oauth/authorize ──
  if (path.endsWith("/authorize")) {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return new Response(
        JSON.stringify({ error: "Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope:
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
      access_type: "offline",
      prompt: "consent",
    });

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      },
    });
  }

  // ── Route 2: /google-oauth/callback ──
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response(
        JSON.stringify({ error: "Missing code parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const clientId = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
    const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI")!;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return new Response(
        JSON.stringify({ error: "Token exchange failed", details: tokenData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const tokenExpiry = new Date(Date.now() + expires_in * 1000).toISOString();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch all calendars from the user's Google account
    let calendars: any[] = [];
    try {
      const calListRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${access_token}` } },
      );
      const calListData = await calListRes.json();
      calendars = calListData.items || [];
    } catch {
      // Fallback to primary only
      calendars = [{ id: "primary", summary: "Google Calendar", backgroundColor: "#4285F4" }];
    }

    if (calendars.length === 0) {
      calendars = [{ id: "primary", summary: "Google Calendar", backgroundColor: "#4285F4" }];
    }

    // Delete existing google accounts to avoid duplicates on re-auth
    await supabase.from("calendar_accounts").delete().eq("provider", "google");

    // Insert one row per calendar
    const rows = calendars.map((cal: any) => ({
      provider: "google",
      access_token,
      refresh_token,
      token_expiry: tokenExpiry,
      calendar_id: cal.id,
      label: cal.summary || cal.id,
      color: cal.backgroundColor || null,
      is_active: true,
    }));

    const { error: dbError } = await supabase.from("calendar_accounts").insert(rows);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: "Failed to save accounts", details: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Trigger a pull for each calendar
    const { data: savedAccounts } = await supabase
      .from("calendar_accounts")
      .select("id")
      .eq("provider", "google")
      .eq("is_active", true);

    if (savedAccounts) {
      for (const acc of savedAccounts) {
        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/calendar-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ account_id: acc.id, direction: "pull" }),
          });
        } catch { /* ignore individual sync errors */ }
      }
    }

    const appUrl = Deno.env.get("APP_URL") || "https://euthymia-zenflow-bento.lovable.app";
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${appUrl}/calendar?connected=true` },
    });
  }

  return new Response(
    JSON.stringify({ error: "Not found" }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
