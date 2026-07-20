import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Transcribe audio via Lovable AI /v1/audio/transcriptions (openai/gpt-4o-mini-transcribe).
// Body: { audio: base64, mimeType: string, language?: string }
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

    // Decode base64 → bytes
    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    if (bytes.byteLength < 512) {
      return new Response(
        JSON.stringify({ error: "Audio vide ou trop court." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pick a filename extension the provider recognizes from the MIME.
    const mt = (mimeType || "audio/webm").toLowerCase();
    const ext = /mp4|m4a|aac/.test(mt) ? "m4a"
              : /ogg/.test(mt)         ? "ogg"
              : /wav/.test(mt)         ? "wav"
              : /mpeg|mp3/.test(mt)    ? "mp3"
              :                          "webm";
    const contentType = ext === "m4a" ? "audio/mp4"
                      : ext === "ogg" ? "audio/ogg"
                      : ext === "wav" ? "audio/wav"
                      : ext === "mp3" ? "audio/mpeg"
                      :                 "audio/webm";

    const form = new FormData();
    form.append("model", "openai/gpt-4o-mini-transcribe");
    form.append("file", new Blob([bytes], { type: contentType }), `recording.${ext}`);
    // ISO-639-1 language hint. Pass a bare code (e.g. "fr", "en") to boost accuracy;
    // omit for auto-detect. Any legacy value (e.g. "français", "fr-FR") is ignored.
    if (typeof language === "string") {
      const code = language.trim().toLowerCase().slice(0, 2);
      if (/^[a-z]{2}$/.test(code) && code !== "au") {
        form.append("language", code);
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: form,
      },
    );

    if (!response.ok) {
      const status = response.status;
      const details = await response.text();
      console.error("AI transcription error:", status, details);
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite atteinte, réessayez plus tard." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Crédits IA épuisés. Ajoutez des crédits à votre espace de travail." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "Erreur de transcription IA", details }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const transcript: string = (data.text || "").trim();

    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("transcribe-audio error:", e);
    return new Response(
      JSON.stringify({ error: e?.message || "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
