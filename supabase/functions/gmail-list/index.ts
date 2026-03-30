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

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  try {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ""
  }
}

function getHeader(headers: any[], name: string): string {
  const h = headers?.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? ""
}

function extractBody(payload: any): string {
  // Simple text body
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data)
  }
  // Multipart: find text/plain or text/html
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data)
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        // Strip HTML tags for a preview
        const html = decodeBase64Url(part.body.data)
        return html.replace(/<[^>]*>/g, "").substring(0, 500)
      }
    }
    // Nested multipart
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = extractBody(part)
        if (nested) return nested
      }
    }
  }
  return ""
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

    const url = new URL(req.url)
    const maxResults = Math.min(parseInt(url.searchParams.get("maxResults") ?? "10"), 20)
    const query = url.searchParams.get("q") ?? ""

    // Get Gmail connection
    const { data: conn } = await supabaseAdmin.from("gmail_connections")
      .select("*").eq("user_id", userId).limit(1).single()

    if (!conn) {
      return new Response(JSON.stringify({ error: "Gmail not connected" }), { status: 400, headers: corsHeaders })
    }

    const accessToken = await refreshTokenIfNeeded(conn)

    // List messages
    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
    listUrl.searchParams.set("maxResults", String(maxResults))
    if (query) listUrl.searchParams.set("q", query)

    const listRes = await fetch(listUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!listRes.ok) {
      const err = await listRes.json()
      return new Response(JSON.stringify({ error: err.error?.message || "List failed" }), { status: 400, headers: corsHeaders })
    }

    const listData = await listRes.json()
    const messageIds: string[] = (listData.messages ?? []).map((m: any) => m.id)

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ messages: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // Fetch each message details (batch)
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!msgRes.ok) return null
        const msg = await msgRes.json()

        const headers = msg.payload?.headers ?? []
        const snippet = extractBody(msg.payload) || msg.snippet || ""

        return {
          id: msg.id,
          threadId: msg.threadId,
          from: getHeader(headers, "From"),
          to: getHeader(headers, "To"),
          subject: getHeader(headers, "Subject"),
          date: getHeader(headers, "Date"),
          snippet: snippet.substring(0, 300),
          isUnread: (msg.labelIds ?? []).includes("UNREAD"),
        }
      })
    )

    return new Response(
      JSON.stringify({ messages: messages.filter(Boolean) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})
