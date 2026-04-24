// Edge function: envoie un email via SMTP du compte IMAP
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

    const { account_id, to, cc, bcc, subject, body, html, in_reply_to } =
      await req.json();

    if (!account_id || !to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: account } = await supabase
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

    const client = new SMTPClient({
      connection: {
        hostname: account.smtp_host || account.imap_host,
        port: account.smtp_port || 587,
        tls: account.smtp_secure ?? true,
        auth: {
          username: account.smtp_username || account.imap_username || account.email_address,
          password: account.smtp_password || account.imap_password,
        },
      },
    });

    await client.send({
      from: account.display_name
        ? `${account.display_name} <${account.email_address}>`
        : account.email_address,
      to: Array.isArray(to) ? to : [to],
      cc: cc && cc.length > 0 ? (Array.isArray(cc) ? cc : [cc]) : undefined,
      bcc: bcc && bcc.length > 0 ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      subject,
      content: body || "",
      html: html || undefined,
      inReplyTo: in_reply_to || undefined,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("smtp-send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
