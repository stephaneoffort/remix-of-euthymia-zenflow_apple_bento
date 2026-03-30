import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

async function refreshTokenIfNeeded(connection: any) {
  const expiry = new Date(connection.token_expiry)
  if (expiry.getTime() - Date.now() > 5 * 60 * 1000) {
    return connection.access_token
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID") ?? "",
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "",
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  const tokens = await res.json()
  if (tokens.error) throw new Error(`Token refresh failed: ${tokens.error}`)

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000)
  await supabaseAdmin.from("gmail_connections").update({
    access_token: tokens.access_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("user_id", connection.user_id)

  return tokens.access_token
}

function buildRawEmail(to: string, subject: string, body: string, fromEmail: string, fromName: string): string {
  const boundary = "boundary_" + crypto.randomUUID().replace(/-/g, "")
  const lines = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(body.replace(/<[^>]*>/g, "")))),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    btoa(unescape(encodeURIComponent(body))),
    ``,
    `--${boundary}--`,
  ]
  return lines.join("\r\n")
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""))
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders })
    }
    const userId = claimsData.claims.sub

    const { to, subject, body } = await req.json()
    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ error: "Missing to, subject or body" }), { status: 400, headers: corsHeaders })
    }

    // Get Gmail connection
    const { data: conn } = await supabaseAdmin.from("gmail_connections")
      .select("*").eq("user_id", userId).limit(1).single()

    if (!conn) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 400, headers: corsHeaders })
    }

    const accessToken = await refreshTokenIfNeeded(conn)

    const raw = buildRawEmail(to, subject, body, conn.email ?? "", conn.display_name ?? "")
    const encodedMessage = btoa(unescape(encodeURIComponent(raw)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedMessage }),
    })

    if (!sendRes.ok) {
      const err = await sendRes.json()
      return new Response(JSON.stringify({ error: err.error?.message || "Send failed" }), { status: 400, headers: corsHeaders })
    }

    const result = await sendRes.json()
    return new Response(JSON.stringify({ success: true, messageId: result.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
