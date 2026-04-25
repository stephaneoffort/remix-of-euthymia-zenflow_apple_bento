import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const token = authHeader.replace("Bearer ", "")
  const { data, error } = await supabaseUser.auth.getClaims(token)
  if (error || !data?.claims) {
    throw new Error("UNAUTHORIZED")
  }

  return data.claims.sub as string
}

async function getValidToken(userId: string): Promise<string> {
  const { data: conn } = await supabase
    .from("drive_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!conn) throw new Error("No Drive connection found for this user");

  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error("Token refresh failed: " + tokens.error);

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await supabase.from("drive_connections").update({
    access_token: tokens.access_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("id", conn.id);

  return tokens.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user via JWT
    let userId: string;
    try {
      userId = await authenticateUser(req);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, query, file_id, entity_type, entity_id, attachment_id } = await req.json();

    // DB-only actions don't need a Google token
    const needsToken = !["list_attachments", "detach"].includes(action);
    const token = needsToken ? await getValidToken(userId) : "";

    // ── Search files ──
    if (action === "search") {
      const q = query
        ? `name contains '${query.replace(/'/g, "\\'")}' and trashed=false`
        : "trashed=false";
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
        new URLSearchParams({
          q,
          pageSize: "20",
          fields: "files(id,name,mimeType,size,thumbnailLink,webViewLink,modifiedTime)",
          orderBy: "modifiedTime desc",
        }),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data.files ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Recent files ──
    if (action === "recent") {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?` +
        new URLSearchParams({
          q: "trashed=false",
          pageSize: "10",
          fields: "files(id,name,mimeType,size,thumbnailLink,webViewLink,modifiedTime)",
          orderBy: "modifiedTime desc",
        }),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      return new Response(JSON.stringify(data.files ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Attach file ──
    if (action === "attach") {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${file_id}?` +
        new URLSearchParams({
          fields: "id,name,mimeType,size,thumbnailLink,webViewLink",
        }),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const file = await res.json();
      if (file.error) throw new Error(file.error.message);

      const { data, error } = await supabase.from("drive_attachments").insert({
        user_id: userId,
        entity_type,
        entity_id,
        file_id: file.id,
        file_name: file.name,
        file_url: file.webViewLink,
        mime_type: file.mimeType,
        thumbnail_url: file.thumbnailLink ?? null,
        file_size: file.size ? parseInt(file.size) : null,
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── List attachments ──
    if (action === "list_attachments") {
      const { data } = await supabase
        .from("drive_attachments")
        .select("*")
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify(data ?? []), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Detach ──
    if (action === "detach") {
      await supabase.from("drive_attachments").delete().eq("id", attachment_id).eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Drive API error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});