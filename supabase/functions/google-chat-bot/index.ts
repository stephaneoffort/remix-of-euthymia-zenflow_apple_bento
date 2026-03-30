import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
)

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // Vérifier que la requête vient bien de Google Chat
    const contentType = req.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const body = await req.json()
    const { type, message, user } = body

    // MESSAGE event from Google Chat
    if (type === "MESSAGE") {
      const text = message?.text ?? ""
      const senderEmail = user?.email ?? ""

      // Find ZenFlow user by email
      const { data: profiles } = await supabase
        .from("team_members")
        .select("id, email")
        .eq("email", senderEmail)
        .limit(1)

      // Also try auth users
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
      const authUser = authUsers?.find((u: any) => u.email === senderEmail)

      if (!authUser) {
        return new Response(JSON.stringify({
          text: "❌ Ton compte Google n'est pas lié à ZenFlow. Connecte-toi sur euthymia-zenflow-bento.lovable.app"
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      const userId = authUser.id

      // /zenflow task [title]
      if (text.startsWith("/zenflow task ") || text.startsWith("/zt ")) {
        const taskTitle = text.replace("/zenflow task ", "").replace("/zt ", "").trim()
        if (!taskTitle) {
          return new Response(JSON.stringify({
            text: "⚠️ Usage : `/zenflow task [titre de la tâche]`"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Get the first available list for this user
        const { data: lists } = await supabase
          .from("task_lists")
          .select("id")
          .limit(1)

        if (!lists?.length) {
          return new Response(JSON.stringify({
            text: "❌ Aucune liste de tâches trouvée dans ZenFlow"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const { data: task } = await supabase
          .from("tasks")
          .insert({
            title: taskTitle,
            status: "todo",
            priority: "normal",
            list_id: lists[0].id,
          })
          .select()
          .single()

        await supabase.from("chat_bot_commands").insert({
          user_id: userId,
          command: "create_task",
          payload: { title: taskTitle },
          result: { task_id: task?.id },
        })

        return new Response(JSON.stringify({
          text: `✅ Tâche créée dans ZenFlow : *${taskTitle}*\n👉 https://euthymia-zenflow-bento.lovable.app`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // /zenflow done [title]
      if (text.startsWith("/zenflow done ")) {
        const taskRef = text.replace("/zenflow done ", "").trim()
        const { data: task } = await supabase
          .from("tasks")
          .select("id, title")
          .ilike("title", `%${taskRef}%`)
          .neq("status", "done")
          .limit(1)
          .single()

        if (!task) {
          return new Response(JSON.stringify({
            text: `❌ Tâche "${taskRef}" non trouvée dans ZenFlow`
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        await supabase.from("tasks").update({ status: "done" }).eq("id", task.id)

        await supabase.from("chat_bot_commands").insert({
          user_id: userId,
          command: "done",
          payload: { title: taskRef },
          result: { task_id: task.id },
        })

        return new Response(JSON.stringify({
          text: `✅ Tâche marquée comme terminée : *${task.title}*`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // /zenflow list
      if (text.includes("/zenflow list") || text.includes("/ztl")) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("title, status, due_date")
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(5)

        if (!tasks?.length) {
          return new Response(JSON.stringify({
            text: "📋 Aucune tâche en cours dans ZenFlow"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        const statusEmoji: Record<string, string> = {
          todo: "🔵",
          in_progress: "🟡",
          cancelled: "🔴",
        }

        const list = tasks.map((t: any) =>
          `${statusEmoji[t.status] ?? "🔵"} ${t.title}`
        ).join("\n")

        return new Response(JSON.stringify({
          text: `📋 *Tes tâches ZenFlow :*\n${list}\n\n👉 https://euthymia-zenflow-bento.lovable.app`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // /zenflow help
      if (text.includes("/zenflow help") || text.includes("/zth")) {
        return new Response(JSON.stringify({
          text: [
            "🤖 *ZenFlow Bot — Commandes disponibles :*",
            "",
            "`/zenflow task [titre]` — Créer une tâche",
            "`/zt [titre]` — Raccourci créer une tâche",
            "`/zenflow done [titre]` — Marquer comme terminée",
            "`/zenflow list` — Voir tes tâches en cours",
            "`/ztl` — Raccourci liste des tâches",
            "`/zenflow help` — Afficher cette aide",
          ].join("\n")
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      return new Response(JSON.stringify({ text: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // ADDED_TO_SPACE
    if (type === "ADDED_TO_SPACE") {
      return new Response(JSON.stringify({
        text: [
          "👋 Bonjour ! Je suis le bot *ZenFlow* d'Euthymia.",
          "",
          "Je peux créer et gérer tes tâches directement depuis Google Chat.",
          "",
          "Tape `/zenflow help` pour voir les commandes disponibles.",
        ].join("\n")
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    return new Response(JSON.stringify({ text: "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } })
  } catch (err) {
    console.error("Chat bot error:", err)
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } })
  }
})
