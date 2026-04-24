// Edge function: actions sur emails IMAP (mark read, delete, move)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ImapFlow } from "https://esm.sh/imapflow@1.0.164";

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { account_id, message_id, action } = await req.json();
    // action: 'mark_read' | 'mark_unread' | 'delete'

    if (!account_id || !message_id || !action) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msg } = await supabase
      .from("email_messages")
      .select("*")
      .eq("id", message_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!msg) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: account } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("id", account_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!account || account.account_type !== "imap") {
      return new Response(JSON.stringify({ error: "IMAP account not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
    const lock = await client.getMailboxLock(msg.folder);

    try {
      const uid = parseInt(msg.external_id);
      if (action === "mark_read") {
        await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
        await supabase
          .from("email_messages")
          .update({ is_read: true })
          .eq("id", message_id);
      } else if (action === "mark_unread") {
        await client.messageFlagsRemove({ uid }, ["\\Seen"], { uid: true });
        await supabase
          .from("email_messages")
          .update({ is_read: false })
          .eq("id", message_id);
      } else if (action === "delete") {
        await client.messageDelete({ uid }, { uid: true });
        await supabase.from("email_messages").delete().eq("id", message_id);
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("imap-action error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
