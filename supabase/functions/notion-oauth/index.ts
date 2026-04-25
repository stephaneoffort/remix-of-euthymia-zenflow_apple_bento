import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTION_CLIENT_ID = Deno.env.get("NOTION_CLIENT_ID") ?? "";
const NOTION_CLIENT_SECRET = Deno.env.get("NOTION_CLIENT_SECRET") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

// L'URL de redirection est calculée à partir de SUPABASE_URL pour éviter
// d'avoir à configurer un secret dédié. Elle DOIT être identique à celle
// déclarée dans l'app OAuth Notion.
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/notion-oauth/callback`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function html(message: string, status = 200) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Notion</title><body style="font-family:system-ui;padding:24px">${message}</body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
    return html(
      "Notion OAuth n'est pas configuré côté serveur (NOTION_CLIENT_ID / NOTION_CLIENT_SECRET manquants).",
      500,
    );
  }

  const url = new URL(req.url);
  const path = url.pathname;

  // ────────────────────────────────────────────────────────────────────
  // /authorize : redirige vers Notion (state = user_id)
  // ────────────────────────────────────────────────────────────────────
  if (path.endsWith("/authorize")) {
    const userId = url.searchParams.get("user_id") || url.searchParams.get("state") || "";
    if (!userId) return html("Paramètre user_id manquant.", 400);

    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", NOTION_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("state", userId);
    return Response.redirect(authUrl.toString(), 302);
  }

  // ────────────────────────────────────────────────────────────────────
  // /callback : Notion renvoie ?code=...&state=user_id
  // ────────────────────────────────────────────────────────────────────
  if (path.endsWith("/callback")) {
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    const back = (qs: string) =>
      Response.redirect(`${APP_URL}/settings/integrations?${qs}`, 302);

    if (errorParam) return back(`provider=notion&status=error&reason=${encodeURIComponent(errorParam)}`);
    if (!code || !userId) return back("provider=notion&status=error&reason=missing_code_or_state");

    try {
      const basic = btoa(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`);
      const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokenRes.ok) {
        console.error("Notion token error:", tokens);
        return back(`provider=notion&status=error&reason=${encodeURIComponent(tokens.error ?? "token_exchange")}`);
      }

      const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const payload = {
        user_id: userId,
        access_token: tokens.access_token,
        workspace_id: tokens.workspace_id,
        workspace_name: tokens.workspace_name ?? null,
        workspace_icon: tokens.workspace_icon ?? null,
        bot_id: tokens.bot_id ?? null,
        owner: tokens.owner ?? null,
        updated_at: new Date().toISOString(),
      };

      // Upsert sur user_id (UNIQUE)
      const { error: upErr } = await db
        .from("notion_connections")
        .upsert(payload, { onConflict: "user_id" });
      if (upErr) {
        console.error("notion_connections upsert error:", upErr);
        return back(`provider=notion&status=error&reason=db_save_failed`);
      }

      // member_integrations
      const nowIso = new Date().toISOString();
      const { data: existingMI } = await db
        .from("member_integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("integration", "notion")
        .maybeSingle();

      const miPayload = {
        user_id: userId,
        integration: "notion",
        is_enabled: true,
        is_connected: true,
        enabled_at: nowIso,
        connected_at: nowIso,
        updated_at: nowIso,
      };
      if (existingMI?.id) {
        await db.from("member_integrations").update(miPayload).eq("id", existingMI.id);
      } else {
        await db.from("member_integrations").insert(miPayload);
      }

      return back("provider=notion&status=connected");
    } catch (e) {
      console.error("Notion callback exception:", e);
      return back("provider=notion&status=error&reason=exception");
    }
  }

  return new Response("Not found", { status: 404 });
});
