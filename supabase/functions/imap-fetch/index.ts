// Edge function: récupère les emails via IMAP et les cache dans email_messages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapFlow } from "https://esm.sh/imapflow@1.0.164";
import { simpleParser } from "https://esm.sh/mailparser@3.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    const { account_id, folder = "INBOX", limit = 30 } = await req.json();
    if (!account_id) {
      return new Response(JSON.stringify({ error: "account_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account, error: accErr } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (accErr || !account) {
      return new Response(JSON.stringify({ error: "Account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (account.account_type !== "imap") {
      return new Response(
        JSON.stringify({ error: "Only IMAP accounts supported here" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const client = new ImapFlow({
      host: account.imap_host,
      port: account.imap_port || 993,
      secure: account.imap_secure ?? true,
      auth: {
        user: account.imap_username || account.email_address,
        pass: account.imap_password,
      },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder);
    const messages: any[] = [];
    let unreadCount = 0;

    try {
      const status = await client.status(folder, { unseen: true });
      unreadCount = status.unseen || 0;

      const mailbox: any = client.mailbox;
      const total = mailbox?.exists || 0;
      const start = Math.max(1, total - limit + 1);
      const range = `${start}:*`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        source: true,
      })) {
        try {
          const parsed = await simpleParser(msg.source as any);
          const externalId = String(msg.uid);

          messages.push({
            account_id,
            user_id: user.id,
            external_id: externalId,
            folder,
            from_address:
              parsed.from?.value?.[0]?.address || "unknown@unknown",
            from_name: parsed.from?.value?.[0]?.name || null,
            to_addresses: (parsed.to as any)?.value?.map((a: any) => a.address) || [],
            cc_addresses: (parsed.cc as any)?.value?.map((a: any) => a.address) || [],
            subject: parsed.subject || "(sans objet)",
            preview: (parsed.text || "").slice(0, 200),
            body_text: parsed.text || "",
            body_html: parsed.html || "",
            is_read: !msg.flags?.has("\\Seen") ? false : true,
            has_attachments: (parsed.attachments?.length || 0) > 0,
            attachments:
              parsed.attachments?.map((a: any) => ({
                filename: a.filename,
                contentType: a.contentType,
                size: a.size,
              })) || [],
            received_at: parsed.date?.toISOString() || new Date().toISOString(),
          });
        } catch (parseErr) {
          console.error("Parse error", parseErr);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    if (messages.length > 0) {
      // Upsert sur (account_id, external_id, folder)
      await supabase.from("email_messages").upsert(messages, {
        onConflict: "account_id,external_id,folder",
      });
    }

    await supabase
      .from("email_accounts")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_error: null,
        unread_count: unreadCount,
      })
      .eq("id", account_id);

    return new Response(
      JSON.stringify({ success: true, fetched: messages.length, unread: unreadCount }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("imap-fetch error:", error);
    try {
      const body = await req.clone().json();
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabase
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
