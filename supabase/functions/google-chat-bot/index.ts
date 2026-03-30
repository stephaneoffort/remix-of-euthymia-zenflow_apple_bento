import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    console.log("Received:", rawBody)

    let body: any = {}
    try {
      body = JSON.parse(rawBody)
    } catch {
      return new Response(
        JSON.stringify({ text: "" }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── Extract data from Google Chat payload ─────────────
    // Google Chat sends: body.chat.messagePayload.message.text
    // Fallback to legacy body.message.text for compatibility
    const chat = body?.chat ?? {}
    const chatMessage = chat?.messagePayload?.message ?? {}
    const legacyMessage = body?.message ?? {}

    const text = (
      chatMessage?.text ??
      chatMessage?.argumentText ??
      legacyMessage?.text ??
      ""
    ).trim()

    const senderEmail = (
      chat?.user?.email ??
      body?.user?.email ??
      chatMessage?.sender?.email ??
      ""
    )

    const type = body?.type ?? chat?.type ?? ""

    console.log("Type:", type, "Text:", text, "Email:", senderEmail)

    const lowerText = text.toLowerCase()

    // Helper: lazy Supabase client
    const getSupabase = () => createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // ── ADDED_TO_SPACE ────────────────────────────────────
    if (type === "ADDED_TO_SPACE") {
      return new Response(
        JSON.stringify({ text: "👋 ZenFlow Bot connecté ! Tape /zenflow help" }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── HELP ──────────────────────────────────────────────
    if (lowerText.includes("help") || lowerText.includes("/zth")) {
      return new Response(
        JSON.stringify({
          text: [
            "🤖 *ZenFlow Bot — Commandes disponibles :*",
            "",
            "`/zenflow task [titre]` — Créer une tâche",
            "`/zt [titre]` — Raccourci créer une tâche",
            "`/zenflow list` — Voir tes tâches en cours",
            "`/ztl` — Raccourci liste",
            "`/zenflow done [titre]` — Marquer comme terminée",
            "`/zenflow assign [titre] @membre` — Assigner",
            "`/zenflow help` — Cette aide",
            "",
            "👉 https://euthymia-zenflow-bento.lovable.app",
          ].join("\n")
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── CREATE TASK ───────────────────────────────────────
    if (lowerText.startsWith("/zenflow task ") || lowerText.startsWith("/zt ")) {
      const taskTitle = text
        .replace(/^\/zenflow task /i, "")
        .replace(/^\/zt /i, "")
        .trim()

      if (!taskTitle) {
        return new Response(
          JSON.stringify({ text: "⚠️ Usage : `/zenflow task [titre de la tâche]`" }),
          { status: 200, headers: corsHeaders }
        )
      }

      const supabase = getSupabase()

      const { data: users } = await supabase
        .rpc("get_user_by_email", { p_email: senderEmail })

      if (!users?.length) {
        return new Response(
          JSON.stringify({
            text: `❌ Ton email *${senderEmail}* n'est pas lié à ZenFlow.\n👉 Connecte-toi sur https://euthymia-zenflow-bento.lovable.app`
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      const { data: lists } = await supabase
        .from("task_lists").select("id").limit(1)

      if (!lists?.length) {
        return new Response(
          JSON.stringify({ text: "❌ Aucune liste de tâches trouvée" }),
          { status: 200, headers: corsHeaders }
        )
      }

      await supabase.from("tasks").insert({
        title: taskTitle,
        status: "todo",
        priority: "normal",
        list_id: lists[0].id,
      })

      return new Response(
        JSON.stringify({
          text: `✅ Tâche créée : *${taskTitle}*\n👉 https://euthymia-zenflow-bento.lovable.app`
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── ASSIGN ────────────────────────────────────────────
    if (lowerText.startsWith("/zenflow assign ")) {
      const assignArgs = text.replace(/^\/zenflow assign /i, "").trim()
      const mentionMatch = assignArgs.match(/^(.+?)\s+@(.+)$/i)

      if (!mentionMatch) {
        return new Response(
          JSON.stringify({ text: "⚠️ Usage : `/zenflow assign [titre] @membre`\nExemple : `/zenflow assign Préparer réunion @Marie`" }),
          { status: 200, headers: corsHeaders }
        )
      }

      const taskRef = mentionMatch[1].trim()
      const memberName = mentionMatch[2].trim()
      const supabase = getSupabase()

      const { data: task } = await supabase
        .from("tasks")
        .select("id, title")
        .ilike("title", `%${taskRef}%`)
        .neq("status", "done")
        .limit(1)
        .single()

      if (!task) {
        return new Response(
          JSON.stringify({ text: `❌ Tâche "${taskRef}" non trouvée` }),
          { status: 200, headers: corsHeaders }
        )
      }

      const { data: members } = await supabase
        .from("team_members")
        .select("id, name")
        .ilike("name", `%${memberName}%`)
        .limit(1)

      if (!members?.length) {
        return new Response(
          JSON.stringify({ text: `❌ Membre "${memberName}" non trouvé` }),
          { status: 200, headers: corsHeaders }
        )
      }

      const member = members[0]

      const { data: existing } = await supabase
        .from("task_assignees")
        .select("task_id")
        .eq("task_id", task.id)
        .eq("member_id", member.id)
        .limit(1)

      if (existing?.length) {
        return new Response(
          JSON.stringify({ text: `ℹ️ *${member.name}* est déjà assigné(e) à *${task.title}*` }),
          { status: 200, headers: corsHeaders }
        )
      }

      await supabase.from("task_assignees").insert({
        task_id: task.id, member_id: member.id,
      })

      // Notification via comment with @mention
      const { data: senderMembers } = await supabase
        .from("team_members")
        .select("id, name")
        .ilike("email", `%${senderEmail}%`)
        .limit(1)

      const senderMemberId = senderMembers?.[0]?.id
      const senderName = senderMembers?.[0]?.name || senderEmail

      if (senderMemberId) {
        await supabase.from("comments").insert({
          task_id: task.id,
          author_id: senderMemberId,
          content: `📌 @${member.name} a été assigné(e) à cette tâche via Google Chat par ${senderName}`,
          mentioned_member_ids: [member.id],
        })
      }

      return new Response(
        JSON.stringify({ text: `✅ *${member.name}* assigné(e) à *${task.title}*` }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── DONE ──────────────────────────────────────────────
    if (lowerText.startsWith("/zenflow done ")) {
      const taskRef = text.replace(/^\/zenflow done /i, "").trim()
      const supabase = getSupabase()

      const { data: task } = await supabase
        .from("tasks")
        .select("id, title")
        .ilike("title", `%${taskRef}%`)
        .neq("status", "done")
        .limit(1)
        .single()

      if (!task) {
        return new Response(
          JSON.stringify({ text: `❌ Tâche "${taskRef}" non trouvée` }),
          { status: 200, headers: corsHeaders }
        )
      }

      await supabase.from("tasks").update({ status: "done" }).eq("id", task.id)

      return new Response(
        JSON.stringify({ text: `✅ *${task.title}* marquée comme terminée !` }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── LIST ──────────────────────────────────────────────
    if (lowerText.includes("/zenflow list") || lowerText.includes("/ztl")) {
      const supabase = getSupabase()

      const { data: tasks } = await supabase
        .from("tasks")
        .select("title, status")
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(5)

      if (!tasks?.length) {
        return new Response(
          JSON.stringify({ text: "📋 Aucune tâche en cours dans ZenFlow" }),
          { status: 200, headers: corsHeaders }
        )
      }

      const emoji: Record<string, string> = {
        todo: "🔵", in_progress: "🟡", cancelled: "🔴"
      }
      const list = tasks
        .map((t: any) => `${emoji[t.status] ?? "🔵"} ${t.title}`)
        .join("\n")

      return new Response(
        JSON.stringify({ text: `📋 *Tes tâches ZenFlow :*\n${list}` }),
        { status: 200, headers: corsHeaders }
      )
    }

    // ── Unrecognized / other event types ──────────────────
    if (type === "MESSAGE" || !type) {
      return new Response(
        JSON.stringify({ text: "Tape `/zenflow help` pour voir les commandes disponibles." }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ text: "" }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    console.error("Error:", err)
    return new Response(
      JSON.stringify({ text: "❌ Une erreur est survenue. Réessaie." }),
      { status: 200, headers: corsHeaders }
    )
  }
})
