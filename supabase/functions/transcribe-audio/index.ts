import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Transcribe an audio recording using Lovable AI (Gemini supports audio input)
// Body: { audio: base64-encoded audio, mimeType: string, language?: string }
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, mimeType, language } = await req.json();

    if (!audio || typeof audio !== "string") {
      return new Response(
        JSON.stringify({ error: "Le champ 'audio' (base64) est requis." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = language || "français";
    const mt = mimeType || "audio/webm";

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                `Tu es un transcripteur audio. Transcris fidèlement le contenu audio en ${lang}, sans ajouter de commentaire, sans reformuler, sans guillemets. Retourne uniquement le texte transcrit.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: audio,
                    format: mt.includes("mp4")
                      ? "mp4"
                      : mt.includes("ogg")
                      ? "ogg"
                      : mt.includes("wav")
                      ? "wav"
                      : "webm",
                  },
                },
                {
                  type: "text",
                  text: "Transcris cet audio en texte brut.",
                },
              ],
            },
          ],
          stream: false,
          temperature: 0.1,
        }),
      },
    );

    if (!response.ok) {
      const status = response.status;
      const t = await response.text();
      console.error("AI transcription error:", status, t);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite atteinte, réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erreur de transcription IA", details: t }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const transcript: string = data.choices?.[0]?.message?.content?.trim?.() || "";

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
