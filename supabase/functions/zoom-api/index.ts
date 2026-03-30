import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

const ZOOM_CLIENT_ID = Deno.env.get("ZOOM_CLIENT_ID") ?? "";
const ZOOM_CLIENT_SECRET = Deno.env.get("ZOOM_CLIENT_SECRET") ?? "";

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED");
  }

  const supabaseUser = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseUser.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("UNAUTHORIZED");
  }

  return data.claims.sub as string;
}

async function getValidToken(userId: string): Promise<string> {
  const { data: conn } = await supabase.from("zoom_connections").select("*").eq("user_id", userId).maybeSingle();

  if (!conn) throw new Error("No Zoom connection for this user");

  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token;
  }

  // Refresh
  const credentials = btoa(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`);
  const res = await fetch("https://zoom.us/oauth/token", {
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
  if (tokens.error) throw new Error("Zoom refresh failed: " + tokens.error);

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await supabase
    .from("zoom_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: newExpiry.toISOString(),
    })
    .eq("user_id", userId);

  return tokens.access_token;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let userId: string;
    try {
      userId = await authenticateUser(req);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── Actions that don't need Zoom token ──
    if (action === "list_meetings") {
      const { entity_type, entity_id } = body;
      const { data } = await supabase
        .from("zoom_meetings")
        .select("*")
        .eq("user_id", userId)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify(data ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_local") {
      const { meeting_id } = body;
      await supabase.from("zoom_meetings").delete().eq("id", meeting_id).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── All other actions need a valid Zoom token ──
    const token = await getValidToken(userId);
    const zoomHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    if (action === "create_meeting") {
      const { topic, start_time, duration, entity_type, entity_id, password } = body;

      const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
        method: "POST",
        headers: zoomHeaders,
        body: JSON.stringify({
          topic: topic ?? "Réunion Euthymia",
          type: start_time ? 2 : 1,
          start_time,
          duration: duration ?? 60,
          timezone: "Europe/Paris",
          password: password ?? "",
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            waiting_room: true,
            audio: "both",
            auto_recording: "none",
          },
        }),
      });

      const meeting = await res.json();
      if (meeting.code) throw new Error("Zoom API error: " + meeting.message);

      const { data, error } = await supabase
        .from("zoom_meetings")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          zoom_meeting_id: meeting.id,
          topic: meeting.topic,
          start_time: meeting.start_time ?? null,
          duration: meeting.duration,
          join_url: meeting.join_url,
          start_url: meeting.start_url,
          password: meeting.password ?? null,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_meeting") {
      const { meeting_id, zoom_meeting_id } = body;

      const { data: meeting } = await supabase
        .from("zoom_meetings")
        .select("*")
        .eq("id", meeting_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!meeting) {
        return new Response(JSON.stringify({ error: "Meeting not found" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await fetch(`https://api.zoom.us/v2/meetings/${zoom_meeting_id}`, {
        method: "DELETE",
        headers: zoomHeaders,
      });

      await supabase.from("zoom_meetings").delete().eq("id", meeting_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "profile") {
      const res = await fetch("https://api.zoom.us/v2/users/me", { headers: zoomHeaders });
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Unknown action", { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error("Zoom API error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
