import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es un parseur de tâches. L'utilisateur dicte une tâche à voix haute et tu dois extraire les informations structurées.

RÈGLES :
- Retourne UNIQUEMENT du JSON valide, sans texte avant ou après, sans backticks.
- Si une information n'est pas mentionnée, mets null.
- Les dates doivent être au format YYYY-MM-DD.
- Les heures mentionnées (ex: "à 14h", "à 9h30") doivent être dans le champ "time".
- La priorité est: "urgent", "high", "normal" ou "low".
- Le statut est toujours "todo" sauf si explicitement dit autrement.
- Si l'utilisateur mentionne des sous-tâches, les lister dans "subtasks" (tableau de strings).
- Si l'utilisateur mentionne des personnes à assigner, les mettre dans "assignees" (tableau de noms).
- Les tags sont des mots-clés ou catégories mentionnés.

FORMAT DE SORTIE :
{
  "title": "string",
  "description": "string | null",
  "priority": "urgent | high | normal | low",
  "status": "todo",
  "dueDate": "YYYY-MM-DD | null",
  "dueTime": "HH:MM | null",
  "startDate": "YYYY-MM-DD | null",
  "assignees": ["nom1", "nom2"],
  "tags": ["tag1"],
  "subtasks": ["sous-tâche 1", "sous-tâche 2"],
  "timeEstimate": null
}

EXEMPLES :

Entrée: "Créer une présentation pour le séminaire du 15 avril, c'est urgent, assigner à Stéphane, avec comme sous-tâches préparer les slides, rédiger le script et réserver la salle"
Sortie: {"title":"Créer une présentation pour le séminaire","description":null,"priority":"urgent","status":"todo","dueDate":"2026-04-15","dueTime":null,"startDate":null,"assignees":["Stéphane"],"tags":["séminaire"],"subtasks":["Préparer les slides","Rédiger le script","Réserver la salle"],"timeEstimate":null}

Entrée: "Appeler le comptable demain à 10h30 pour les factures, priorité haute"
Sortie: {"title":"Appeler le comptable pour les factures","description":null,"priority":"high","status":"todo","dueDate":"DEMAIN","dueTime":"10:30","startDate":null,"assignees":[],"tags":["comptabilité"],"subtasks":[],"timeEstimate":null}

Note: pour "demain", "lundi prochain", etc., retourne le mot tel quel dans dueDate — le client résoudra la date.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, today } = await req.json();

    if (!transcript || typeof transcript !== "string") {
      return new Response(
        JSON.stringify({ error: "Le champ 'transcript' est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userMessage = today
      ? `Aujourd'hui nous sommes le ${today}.\n\nDictée : "${transcript}"`
      : `Dictée : "${transcript}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        stream: false,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite atteinte" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "Erreur IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle possible markdown fences)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ task: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("voice-parse-task error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
