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

async function getValidGoogleToken(userId: string): Promise<string | null> {
  const { data: conn } = await supabaseAdmin
    .from("google_chat_connections")
    .select("*")
    .eq("user_id", userId)
    .single()

  if (!conn) return null

  if (new Date(conn.token_expiry) > new Date(Date.now() + 5 * 60 * 1000)) {
    return conn.access_token
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
  })
  const tokens = await res.json()
  if (tokens.error) return null

  await supabaseAdmin.from("google_chat_connections").update({
    access_token: tokens.access_token,
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq("user_id", userId)

  return tokens.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }

  const userId = user.id

  try {
    const body = await req.json()
    const { action } = body

    // LIST SPACES
    if (action === "list_spaces") {
      const token = await getValidGoogleToken(userId)
      if (!token) {
        return new Response(JSON.stringify({ error: "Not connected" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const res = await fetch("https://chat.googleapis.com/v1/spaces", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      return new Response(JSON.stringify(data.spaces ?? []),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // SYNC MENTIONS
    if (action === "sync_mentions") {
      const token = await getValidGoogleToken(userId)
      if (!token) {
        return new Response(JSON.stringify({ synced: 0, error: "Not connected" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Get user's spaces
      const spacesRes = await fetch("https://chat.googleapis.com/v1/spaces", {
        headers: { Authorization: `Bearer ${token}` }
      })
      const spacesData = await spacesRes.json()
      const spaces = spacesData.spaces ?? []

      let totalSynced = 0
      const userEmail = user.email ?? ""

      for (const space of spaces.slice(0, 5)) {
        try {
          const msgsRes = await fetch(
            `https://chat.googleapis.com/v1/${space.name}/messages?pageSize=25`,
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const msgsData = await msgsRes.json()
          const messages = msgsData.messages ?? []

          const mentions = messages.filter((msg: any) => {
            const text = msg.text ?? ""
            const annotations = msg.annotations ?? []
            return (
              text.toLowerCase().includes(`@${userEmail.toLowerCase()}`) ||
              annotations.some((a: any) =>
                a.type === "USER_MENTION" &&
                a.userMention?.user?.email?.toLowerCase() === userEmail.toLowerCase()
              )
            )
          })

          if (mentions.length > 0) {
            const rows = mentions.map((msg: any) => ({
              user_id: userId,
              message_id: msg.name,
              space_id: space.name,
              sender_name: msg.sender?.displayName ?? "Membre",
              sender_email: msg.sender?.name ?? "",
              content: msg.text ?? "",
              thread_id: msg.thread?.name ?? null,
              is_mention: true,
              is_read: false,
              created_at: msg.createTime ?? new Date().toISOString(),
            }))

            await supabaseAdmin
              .from("google_chat_messages")
              .upsert(rows, { onConflict: "user_id,message_id" })

            totalSynced += mentions.length
          }
        } catch (e) {
          console.error(`Error syncing space ${space.name}:`, e)
        }
      }

      return new Response(JSON.stringify({ synced: totalSynced }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // MARK READ
    if (action === "mark_read") {
      const { message_id } = body
      await supabaseAdmin
        .from("google_chat_messages")
        .update({ is_read: true })
        .eq("id", message_id)
        .eq("user_id", userId)
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // UNREAD COUNT
    if (action === "unread_count") {
      const { count } = await supabaseAdmin
        .from("google_chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false)
        .eq("is_mention", true)

      return new Response(JSON.stringify({ count: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })

  } catch (err) {
    console.error("Google Chat sync error:", err)
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
