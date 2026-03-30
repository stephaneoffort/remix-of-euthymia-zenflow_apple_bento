import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Validate caller identity
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // Check admin role using service role client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (!roleData || roleData.length === 0) {
    return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
      status: 403,
      headers: corsHeaders,
    });
  }

  try {
    // Fetch all member_integrations joined with profiles + team_members
    // We only expose: member name, integration key, is_enabled, is_connected
    // NO tokens, NO API keys, NO emails of connected accounts
    const { data: integrations } = await supabase
      .from("member_integrations")
      .select("user_id, integration, is_enabled, is_connected, connected_at");

    // Get profiles to map user_id -> team_member name
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, team_member_id");

    const memberIds = (profiles ?? [])
      .filter((p: any) => p.team_member_id)
      .map((p: any) => p.team_member_id);

    const { data: members } = await supabase
      .from("team_members")
      .select("id, name, email")
      .in("id", memberIds.length > 0 ? memberIds : ["__none__"]);

    // Build a map: user_id -> { name, email }
    const userMap: Record<string, { name: string; email: string }> = {};
    for (const profile of profiles ?? []) {
      const member = (members ?? []).find((m: any) => m.id === profile.team_member_id);
      if (member) {
        userMap[profile.id] = { name: member.name, email: member.email };
      }
    }

    // Group integrations by user
    const result: Array<{
      user_id: string;
      name: string;
      email: string;
      integrations: Record<string, { is_enabled: boolean; is_connected: boolean }>;
    }> = [];

    const groupedByUser: Record<string, any[]> = {};
    for (const row of integrations ?? []) {
      if (!groupedByUser[row.user_id]) groupedByUser[row.user_id] = [];
      groupedByUser[row.user_id].push(row);
    }

    for (const [userId, rows] of Object.entries(groupedByUser)) {
      const info = userMap[userId] ?? { name: "Utilisateur inconnu", email: "" };
      const intMap: Record<string, { is_enabled: boolean; is_connected: boolean }> = {};
      for (const r of rows) {
        intMap[r.integration] = {
          is_enabled: r.is_enabled ?? false,
          is_connected: r.is_connected ?? false,
        };
      }
      result.push({ user_id: userId, name: info.name, email: info.email, integrations: intMap });
    }

    return new Response(JSON.stringify(result), { headers: corsHeaders });
  } catch (err) {
    console.error("Admin integrations error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
