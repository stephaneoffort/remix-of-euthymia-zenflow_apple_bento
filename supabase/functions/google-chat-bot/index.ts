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

  // Logger toute requête entrante pour debug
  console.log("Method:", req.method)
  console.log("Headers:", Object.fromEntries(req.headers.entries()))

  try {
    // Lire le body de façon robuste
    const rawBody = await req.text()
    console.log("Raw body:", rawBody)

    // Parser le JSON de façon sécurisée
    let body: any = {}
    try {
      body = JSON.parse(rawBody)
    } catch {
      // Si pas du JSON → retourner OK pour les requêtes de vérification Google
      console.log("Non-JSON body received, returning OK")
      return new Response(
        JSON.stringify({ text: "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { type, message, user } = body
    console.log("Event type:", type)
    console.log("Message:", JSON.stringify(message))

    // ── MESSAGE ──────────────────────────────────────────
    if (type === "MESSAGE") {
      // Google Chat peut mettre le texte dans message.text OU message.argumentText
      const text = (
        message?.text ??
        message?.argumentText ??
        ""
      ).trim()

      const senderEmail = (
        user?.email ??
        message?.sender?.email ??
        ""
      )

      console.log("Text:", text)
      console.log("Sender:", senderEmail)

      // Trouver l'utilisateur ZenFlow par email via la fonction SQL
      const { data: authUsers } = await supabase
        .rpc("get_user_by_email", { p_email: senderEmail })

      const userId = authUsers?.[0]?.id

      if (!userId) {
        return new Response(JSON.stringify({
          text: `❌ Ton compte *${senderEmail}* n'est pas lié à ZenFlow.\n👉 Connecte-toi sur https://euthymia-zenflow-bento.lovable.app`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // ── /zenflow help ──
      if (text.toLowerCase().includes("help") ||
          text.toLowerCase().includes("/zenflow help") ||
          text.toLowerCase().includes("/zth")) {
        return new Response(JSON.stringify({
          text: [
            "🤖 *ZenFlow Bot — Commandes :*",
            "",
            "`/zenflow task [titre]` — Créer une tâche",
            "`/zt [titre]` — Raccourci créer une tâche",
            "`/zenflow done [titre]` — Marquer terminée",
            "`/zenflow assign [titre] @membre` — Assigner une tâche",
            "`/zenflow list` — Voir tes tâches",
            "`/ztl` — Raccourci liste des tâches",
            "`/zenflow help` — Cette aide",
          ].join("\n")
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // ── /zenflow task [title] ──
      if (text.toLowerCase().startsWith("/zenflow task ") ||
          text.toLowerCase().startsWith("/zt ")) {
        const taskTitle = text
          .replace(/^\/zenflow task /i, "")
          .replace(/^\/zt /i, "")
          .trim()

        if (!taskTitle) {
          return new Response(JSON.stringify({
            text: "⚠️ Usage : `/zenflow task [titre]`"
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
        }

        // Get the first available list for task creation
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
          text: `✅ Tâche créée : *${taskTitle}*\n👉 https://euthymia-zenflow-bento.lovable.app`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // ── /zenflow list ──
      if (text.toLowerCase().includes("/zenflow list") ||
          text.toLowerCase().includes("/ztl")) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("title, status")
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

      // ── /zenflow done [title] ──
      if (text.toLowerCase().startsWith("/zenflow done ")) {
        const taskRef = text.replace(/^\/zenflow done /i, "").trim()

        const { data: task } = await supabase
          .from("tasks")
          .select("id, title")
          .ilike("title", `%${taskRef}%`)
          .neq("status", "done")
          .limit(1)
          .single()

        if (!task) {
          return new Response(JSON.stringify({
            text: `❌ Tâche "${taskRef}" non trouvée`
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
          text: `✅ *${task.title}* marquée comme terminée !`
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
      }

      // Message non reconnu
      return new Response(JSON.stringify({
        text: "Tape `/zenflow help` pour voir les commandes disponibles."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // ── BOT AJOUTÉ ────────────────────────────────────────
    if (type === "ADDED_TO_SPACE") {
      return new Response(JSON.stringify({
        text: "👋 Bonjour ! Je suis *ZenFlow Bot*.\nTape `/zenflow help` pour voir ce que je peux faire."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    // Autres types → OK silencieux
    return new Response(
      JSON.stringify({ text: "" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Chat bot error:", err)
    return new Response(
      JSON.stringify({ text: "" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
