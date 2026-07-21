// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es l'assistant support d'Euthymia ZenFlow, une application de gestion de tâches / projets / calendrier / chat d'équipe.

Ton rôle :
1. Accueillir chaleureusement l'utilisateur en français.
2. Comprendre son problème (bug, question d'usage, suggestion) en posant au maximum 2 questions ciblées (que se passe-t-il, sur quelle page/fonctionnalité, quel navigateur/appareil ? une capture aide).
3. Répondre directement si tu connais la solution (FAQ courantes : rafraîchir la page, se reconnecter, vider le cache, vérifier la connexion internet, autoriser les notifications, réactiver un intégration OAuth, etc.).
4. Si le problème persiste, est manifestement un bug, ou concerne une donnée manquante / une erreur technique — **appelle l'outil escalate_to_admin** avec un résumé clair (2-3 phrases), une priorité ("low" / "normal" / "high" / "urgent") et le contexte technique éventuel.
5. Confirme à l'utilisateur que Stéphane (le concepteur) a été prévenu et qu'il recevra une réponse dans le fil de discussion.

Ton style : concis, empathique, tutoiement, français correct, formatage markdown (listes, gras) autorisé. Ne jamais inventer de fonctionnalité.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non autorisé" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY manquant" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Non autorisé" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { conversationId, message } = await req.json();
    if (!conversationId || !message || typeof message !== "string") {
      return json({ error: "conversationId et message requis" }, 400);
    }

    // Verify user owns the conversation
    const { data: conv } = await admin
      .from("support_conversations")
      .select("id, user_id, subject, escalated")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv || conv.user_id !== user.id) return json({ error: "Conversation introuvable" }, 404);

    // Persist user message
    await admin.from("support_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: message,
      author_id: user.id,
    });

    // Load full history
    const { data: history } = await admin
      .from("support_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const chatMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m: any) => ({
        role: m.role === "admin" ? "assistant" : m.role,
        content: m.role === "admin" ? `[Message de l'administrateur] ${m.content}` : m.content,
      })),
    ];

    // Call Lovable AI Gateway with escalation tool
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        tools: [
          {
            type: "function",
            function: {
              name: "escalate_to_admin",
              description:
                "Escalader la conversation à Stéphane (administrateur) lorsqu'un bug ou un problème requiert une intervention humaine.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "Résumé en 2-3 phrases du problème." },
                  priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
                  reply_to_user: {
                    type: "string",
                    description:
                      "Message court confirmant à l'utilisateur que le concepteur a été prévenu.",
                  },
                },
                required: ["summary", "priority", "reply_to_user"],
                additionalProperties: false,
              },
            },
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const status = aiRes.status;
      const t = await aiRes.text();
      console.error("AI gateway error:", status, t);
      if (status === 429) return json({ error: "Limite de requêtes IA atteinte. Réessaie dans quelques instants." }, 429);
      if (status === 402) return json({ error: "Crédits IA épuisés." }, 402);
      return json({ error: "Erreur de l'assistant IA." }, 500);
    }

    const data = await aiRes.json();
    const choice = data.choices?.[0];
    const toolCall = choice?.message?.tool_calls?.[0];

    let assistantContent = choice?.message?.content ?? "";
    let escalated = false;
    let priority = "normal";
    let summary: string | null = null;

    if (toolCall?.function?.name === "escalate_to_admin") {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        summary = args.summary;
        priority = args.priority ?? "normal";
        assistantContent = args.reply_to_user ||
          "J'ai transmis ta demande à Stéphane. Il te répondra ici dès que possible.";
        escalated = true;
      } catch (e) {
        console.error("tool args parse error", e);
      }
    }

    if (!assistantContent) {
      assistantContent = "Peux-tu préciser ta demande ?";
    }

    // Persist assistant message
    await admin.from("support_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantContent,
      metadata: escalated ? { escalated: true, summary, priority } : {},
    });

    if (escalated && !conv.escalated) {
      await admin
        .from("support_conversations")
        .update({
          escalated: true,
          escalated_at: new Date().toISOString(),
          status: "awaiting_admin",
          priority,
        })
        .eq("id", conversationId);
    }

    return json({ reply: assistantContent, escalated, priority, summary });
  } catch (e) {
    console.error("support-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Erreur inconnue" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
