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

    const toList = Array.isArray(to) ? to : [to];
    const ccList = cc && cc.length > 0 ? (Array.isArray(cc) ? cc : [cc]) : [];
    const bccList = bcc && bcc.length > 0 ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

    // ===== Gmail OAuth path =====
    if (account.account_type === "gmail") {
      // refresh token if needed
      let accessToken = account.oauth_access_token as string;
      const expiry = account.oauth_token_expiry
        ? new Date(account.oauth_token_expiry).getTime()
        : 0;
      if (expiry - Date.now() <= 5 * 60 * 1000) {
        if (!account.oauth_refresh_token) {
          throw new Error("Gmail account needs reconnection");
        }
        const r = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
            client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
            refresh_token: account.oauth_refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const t = await r.json();
        if (t.error) throw new Error(`Token refresh failed: ${t.error}`);
        accessToken = t.access_token;
        await supabase
          .from("email_accounts")
          .update({
            oauth_access_token: t.access_token,
            oauth_token_expiry: new Date(
              Date.now() + t.expires_in * 1000
            ).toISOString(),
          })
          .eq("id", account.id);
      }

      const fromHeader = account.display_name
        ? `${account.display_name} <${account.email_address}>`
        : account.email_address;
      const headers = [
        `From: ${fromHeader}`,
        `To: ${toList.join(", ")}`,
      ];
      if (ccList.length) headers.push(`Cc: ${ccList.join(", ")}`);
      if (bccList.length) headers.push(`Bcc: ${bccList.join(", ")}`);
      headers.push(`Subject: ${subject}`);
      if (in_reply_to) headers.push(`In-Reply-To: ${in_reply_to}`);
      headers.push('MIME-Version: 1.0');
      headers.push('Content-Type: text/plain; charset="UTF-8"');
      const raw = headers.join("\r\n") + "\r\n\r\n" + (body || "");
      const rawB64 = btoa(unescape(encodeURIComponent(raw)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const sendRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw: rawB64 }),
        }
      );
      if (!sendRes.ok) {
        const e = await sendRes.json().catch(() => ({}));
        throw new Error(e.error?.message || "Gmail send failed");
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== IMAP/SMTP path =====
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
      to: toList,
      cc: ccList.length ? ccList : undefined,
      bcc: bccList.length ? bccList : undefined,
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
