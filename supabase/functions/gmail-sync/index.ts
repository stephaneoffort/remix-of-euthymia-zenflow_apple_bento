// Sync Gmail messages for a single email_accounts row (account_type='gmail')
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function refreshIfNeeded(account: any): Promise<string> {
  const expiry = account.oauth_token_expiry
    ? new Date(account.oauth_token_expiry).getTime()
    : 0;
  if (expiry - Date.now() > 5 * 60 * 1000 && account.oauth_access_token) {
    return account.oauth_access_token;
  }
  if (!account.oauth_refresh_token) {
    throw new Error("Missing refresh token — please reconnect this Gmail account");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: account.oauth_refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`);
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);
  await supabaseAdmin
    .from("email_accounts")
    .update({
      oauth_access_token: tokens.access_token,
      oauth_token_expiry: newExpiry.toISOString(),
    })
    .eq("id", account.id);
  return tokens.access_token;
}

function decodeB64Url(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}
function header(headers: any[], name: string): string {
  return (
    headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}
function extractBodies(payload: any): { text: string; html: string } {
  const out = { text: "", html: "" };
  function walk(p: any) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data && !out.text) {
      out.text = decodeB64Url(p.body.data);
    } else if (p.mimeType === "text/html" && p.body?.data && !out.html) {
      out.html = decodeB64Url(p.body.data);
    }
    if (p.parts) p.parts.forEach(walk);
  }
  walk(payload);
  if (!out.text && payload?.body?.data) out.text = decodeB64Url(payload.body.data);
  return out;
}
function parseAddrs(s: string): { addr: string; name: string | null }[] {
  if (!s) return [];
  return s.split(",").map((part) => {
    const m = part.trim().match(/^(?:"?([^"<]+?)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
    if (m) return { name: m[1]?.trim() || null, addr: m[2] };
    return { addr: part.trim(), name: null };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { account_id, limit = 25 } = await req.json();
    const { data: account } = await supabaseAdmin
      .from("email_accounts")
      .select("*")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (account.account_type !== "gmail") {
      return new Response(JSON.stringify({ error: "Not a Gmail account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await refreshIfNeeded(account);

    // List INBOX messages
    const listUrl = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages"
    );
    listUrl.searchParams.set("maxResults", String(Math.min(limit, 50)));
    listUrl.searchParams.set("labelIds", "INBOX");

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) {
      const err = await listRes.json().catch(() => ({}));
      throw new Error(err.error?.message || "Gmail list failed");
    }
    const listData = await listRes.json();
    const ids: string[] = (listData.messages ?? []).map((m: any) => m.id);

    const messages: any[] = [];
    let unread = 0;

    for (const id of ids) {
      const r = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!r.ok) continue;
      const m = await r.json();
      const headers = m.payload?.headers ?? [];
      const bodies = extractBodies(m.payload);
      const fromParsed = parseAddrs(header(headers, "From"))[0];
      const isUnread = (m.labelIds ?? []).includes("UNREAD");
      if (isUnread) unread++;

      messages.push({
        account_id,
        user_id: user.id,
        external_id: m.id,
        thread_id: m.threadId ?? null,
        folder: "INBOX",
        from_address: fromParsed?.addr || "unknown@unknown",
        from_name: fromParsed?.name ?? null,
        to_addresses: parseAddrs(header(headers, "To")).map((p) => p.addr),
        cc_addresses: parseAddrs(header(headers, "Cc")).map((p) => p.addr),
        subject: header(headers, "Subject") || "(sans objet)",
        preview: (bodies.text || m.snippet || "").slice(0, 200),
        body_text: bodies.text,
        body_html: bodies.html,
        is_read: !isUnread,
        has_attachments: false,
        attachments: [],
        received_at: new Date(parseInt(m.internalDate || "0")).toISOString(),
      });
    }

    if (messages.length > 0) {
      await supabaseAdmin
        .from("email_messages")
        .upsert(messages, { onConflict: "account_id,external_id,folder" });
    }

    await supabaseAdmin
      .from("email_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        unread_count: unread,
      })
      .eq("id", account_id);

    return new Response(
      JSON.stringify({ success: true, fetched: messages.length, unread }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("gmail-sync error:", error);
    try {
      const body = await req.clone().json();
      await supabaseAdmin
        .from("email_accounts")
        .update({ last_sync_error: error.message?.slice(0, 500) || "unknown" })
        .eq("id", body.account_id);
    } catch {}
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
