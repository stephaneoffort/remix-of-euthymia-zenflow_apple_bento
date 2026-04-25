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

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseUser.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("UNAUTHORIZED");
  return data.claims.sub as string;
}

async function getValidToken(userId: string): Promise<string> {
  const { data } = await supabase
    .from("miro_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const conn = data as any;
  if (!conn) throw new Error("Aucune connexion Miro trouvée");

  // Miro access tokens are long-lived (1 year). Refresh only if refresh_token exists.
  if (!conn.refresh_token) return conn.access_token;
  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token;
  }

  // Refresh token
  const credentials = btoa(`${MIRO_CLIENT_ID}:${MIRO_CLIENT_SECRET}`);
  const res = await fetch("https://api.miro.com/v1/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: conn.refresh_token,
    }),
  });

  const tokens = await res.json();
  if (tokens.message) throw new Error("Miro refresh failed: " + tokens.message);

  const newExpiry = new Date(Date.now() + (tokens.expires_in ?? 31536000) * 1000).toISOString();
  await supabase.from("miro_connections").update({
    access_token: tokens.access_token,
    token_expiry: newExpiry,
  }).eq("id", conn.id);

  return tokens.access_token;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let userId: string;
    try {
      userId = await authenticateUser(req);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action } = body;

    // ── Supabase-only actions (no Miro token needed) ──
    if (action === "list_attachments") {
      const { entity_type, entity_id } = body;
      const { data } = await supabase
        .from("miro_attachments")
        .select("*")
        .eq("user_id", userId)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false });
      return json(data ?? []);
    }

    if (action === "detach") {
      const { attachment_id } = body;
      await supabase.from("miro_attachments").delete().eq("id", attachment_id).eq("user_id", userId);
      return json({ success: true });
    }

    // ── Actions requiring Miro API ──
    const token = await getValidToken(userId);
    const miroHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (action === "list_boards") {
      const res = await fetch("https://api.miro.com/v2/boards?limit=20&sort=last_modified", {
        headers: miroHeaders,
      });
      const data = await res.json();
      return json(data.data ?? []);
    }

    if (action === "search_boards") {
      const { query } = body;
      const res = await fetch(
        `https://api.miro.com/v2/boards?limit=20&query=${encodeURIComponent(query)}`,
        { headers: miroHeaders },
      );
      const data = await res.json();
      return json(data.data ?? []);
    }

    if (action === "create_board") {
      const { name, description } = body;
      const res = await fetch("https://api.miro.com/v2/boards", {
        method: "POST",
        headers: miroHeaders,
        body: JSON.stringify({
          name: name ?? "Nouveau tableau Euthymia",
          description: description ?? "",
          policy: {
            permissionsPolicy: { collaborationToolsStartAccess: "all_editors", copyAccess: "anyone", sharingAccess: "team_members_with_editing_rights" },
            sharingPolicy: { access: "private", inviteToAccountAndBoardLinkAccess: "viewer", organizationAccess: "private", teamAccess: "private" },
          },
        }),
      });
      const data = await res.json();
      return json(data);
    }

    if (action === "attach") {
      const { board_id, board_name, board_url, entity_type, entity_id } = body;

      // Optionally fetch board thumbnail
      let thumbnailUrl: string | null = null;
      try {
        const boardRes = await fetch(`https://api.miro.com/v2/boards/${board_id}`, { headers: miroHeaders });
        const boardData = await boardRes.json();
        thumbnailUrl = boardData.picture?.imageURL ?? null;
      } catch { /* thumbnail is optional */ }

      const { data, error } = await supabase
        .from("miro_attachments")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          board_id,
          board_name: board_name ?? "Tableau Miro",
          board_url: board_url ?? `https://miro.com/app/board/${board_id}/`,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

      if (error) throw error;
      return json(data);
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (err) {
    console.error("Miro API error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
