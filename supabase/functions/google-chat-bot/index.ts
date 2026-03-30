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

    const type = body?.type ?? ""
    const text = (body?.message?.text ?? "").trim()
    const senderEmail = body?.user?.email ?? ""

    console.log("Type:", type, "Text:", text, "Email:", senderEmail)

    // Réponse immédiate sans appel Supabase pour tester
    if (type === "ADDED_TO_SPACE") {
      return new Response(
        JSON.stringify({ text: "👋 ZenFlow Bot connecté ! Tape /zenflow help" }),
        { status: 200, headers: corsHeaders }
      )
    }

    if (type === "MESSAGE") {
      if (text.includes("help")) {
        return new Response(
          JSON.stringify({
            text: "🤖 *ZenFlow Bot*\n`/zenflow task [titre]` — Créer une tâche\n`/zenflow list` — Mes tâches\n`/zenflow done [titre]` — Terminer"
          }),
          { status: 200, headers: corsHeaders }
        )
      }

      if (text.toLowerCase().startsWith("/zenflow task ") ||
          text.toLowerCase().startsWith("/zt ")) {
        const taskTitle = text
          .replace(/\/zenflow task /i, "")
          .replace(/\/zt /i, "")
          .trim()

        // Appel Supabase pour créer la tâche
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        )

        // Trouver l'utilisateur par email
        const { data: users } = await supabase
          .rpc("get_user_by_email", { p_email: senderEmail })

        const userId = users?.[0]?.id

        if (!userId) {
          return new Response(
            JSON.stringify({
              text: `❌ Email *${senderEmail}* non trouvé dans ZenFlow.\n👉 https://euthymia-zenflow-bento.lovable.app`
            }),
            { status: 200, headers: corsHeaders }
          )
        }

        // Get the first available list for task creation
        const { data: lists } = await supabase
          .from("task_lists")
          .select("id")
          .limit(1)

        if (!lists?.length) {
          return new Response(
            JSON.stringify({ text: "❌ Aucune liste de tâches trouvée dans ZenFlow" }),
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

      if (text.toLowerCase().includes("/zenflow list")) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        )

        const { data: users } = await supabase
          .rpc("get_user_by_email", { p_email: senderEmail })

        const userId = users?.[0]?.id
        if (!userId) {
          return new Response(
            JSON.stringify({ text: "❌ Compte non trouvé dans ZenFlow" }),
            { status: 200, headers: corsHeaders }
          )
        }

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
          JSON.stringify({ text: `📋 *Tes tâches :*\n${list}` }),
          { status: 200, headers: corsHeaders }
        )
      }

      // Message non reconnu
      return new Response(
        JSON.stringify({ text: "Tape `/zenflow help` pour l'aide." }),
        { status: 200, headers: corsHeaders }
      )
    }

    // Tout autre type → OK silencieux
    return new Response(
      JSON.stringify({ text: "" }),
      { status: 200, headers: corsHeaders }
    )

  } catch (err) {
    console.error("Error:", err)
    return new Response(
      JSON.stringify({ text: "" }),
      { status: 200, headers: corsHeaders }
    )
  }
})
