import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Script-based language detection on the transcript itself. Cheap, deterministic,
// and works even when the model happily hallucinates Chinese/Korean on silent audio.
function detectScript(text: string): { lang: string; script: string } {
  const t = text || "";
  const cjk       = (t.match(/[\u4E00-\u9FFF\u3400-\u4DBF]/g) || []).length;
  const hiragana  = (t.match(/[\u3040-\u309F]/g) || []).length;
  const katakana  = (t.match(/[\u30A0-\u30FF]/g) || []).length;
  const hangul    = (t.match(/[\uAC00-\uD7AF]/g) || []).length;
  const cyrillic  = (t.match(/[\u0400-\u04FF]/g) || []).length;
  const arabic    = (t.match(/[\u0600-\u06FF]/g) || []).length;
  const hebrew    = (t.match(/[\u0590-\u05FF]/g) || []).length;
  const latin     = (t.match(/[A-Za-zÀ-ÿ]/g) || []).length;

  const counts: Array<[string, string, number]> = [
    ["zh", "chinois",  cjk],
    ["ja", "japonais", hiragana + katakana],
    ["ko", "coréen",   hangul],
    ["ru", "cyrillique", cyrillic],
    ["ar", "arabe",    arabic],
    ["he", "hébreu",   hebrew],
    ["latin", "latin", latin],
  ];
  counts.sort((a, b) => b[2] - a[2]);
  const [code, script, n] = counts[0];
  if (n === 0) return { lang: "unknown", script: "inconnu" };
  return { lang: code, script };
}

// Guess a Latin-script sublanguage from stopwords, so we can flag e.g. French audio
// transcribed as English.
function guessLatinLanguage(text: string): string | null {
  const s = " " + text.toLowerCase() + " ";
  const hits = (words: string[]) =>
    words.reduce((n, w) => n + (s.includes(" " + w + " ") ? 1 : 0), 0);
  const scores: Record<string, number> = {
    fr: hits(["le","la","les","de","des","une","un","et","est","que","je","tu","pour","avec","pas","dans","sur","au","aux","c'est","ça","ne","à"]),
    en: hits(["the","a","an","and","is","of","to","in","for","that","this","with","you","are","not","on","it","be","have"]),
    es: hits(["el","la","los","las","de","que","y","es","por","con","para","un","una","no","se","en","del"]),
    de: hits(["der","die","das","und","ist","ich","nicht","ein","eine","mit","auf","für","dass","du","zu"]),
    it: hits(["il","la","di","che","e","è","un","una","per","con","non","del","della","sono","si","ma"]),
    pt: hits(["o","a","de","que","e","é","um","uma","não","para","com","por","do","da","os","as"]),
  };
  let best: string | null = null;
  let bestScore = 1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > bestScore) { bestScore = v; best = k; }
  }
  return best;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audio, mimeType, language } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "Le champ 'audio' (base64) est requis." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const binary = atob(audio);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    if (bytes.byteLength < 2048) {
      return new Response(JSON.stringify({ error: "Audio vide ou trop court. Parlez pendant au moins 1 seconde." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    let langCode = "fr";
    if (typeof language === "string") {
      const c = language.trim().toLowerCase().slice(0, 2);
      if (/^[a-z]{2}$/.test(c) && c !== "au") langCode = c;
    }

    const promptByLang: Record<string, string> = {
      fr: "Transcription en français. Application de gestion de tâches, projets, réunions, rappels, échéances.",
      en: "English transcription. Task management app: tasks, projects, meetings, reminders, deadlines.",
      es: "Transcripción en español. Aplicación de gestión de tareas y proyectos.",
      de: "Deutsche Transkription. Aufgaben- und Projektverwaltung.",
      it: "Trascrizione in italiano. Applicazione di gestione di attività e progetti.",
      pt: "Transcrição em português. Aplicação de gestão de tarefas e projetos.",
    };
    const promptHint = promptByLang[langCode] ?? `Transcription in ${langCode}.`;

    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([bytes], { type: contentType }), `recording.${ext}`);
    form.append("language", langCode);
    form.append("prompt", promptHint);
    form.append("temperature", "0");
    // Ask the provider for token-level logprobs so we can compute a confidence score.
    form.append("include[]", "logprobs");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
      { method: "POST", headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` }, body: form },
    );

    if (!response.ok) {
      const status = response.status;
      const details = await response.text();
      console.error("AI transcription error:", status, details);
      const msg = status === 429 ? "Limite atteinte, réessayez plus tard."
                : status === 402 ? "Crédits IA épuisés. Ajoutez des crédits à votre espace de travail."
                : "Erreur de transcription IA";
      return new Response(JSON.stringify({ error: msg, details }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const transcript: string = (data.text || "").trim();

    // Average token logprob → confidence in [0,1].
    let confidence: number | null = null;
    const lp = Array.isArray(data.logprobs) ? data.logprobs : null;
    if (lp && lp.length > 0) {
      const vals = lp.map((x: any) => typeof x?.logprob === "number" ? x.logprob : null)
                     .filter((v: any): v is number => v !== null);
      if (vals.length > 0) {
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        confidence = Math.max(0, Math.min(1, Math.exp(avg)));
      }
    }

    // Detect actual language of the returned text and compare to what was requested.
    const script = detectScript(transcript);
    let detectedLanguage = script.lang;
    if (detectedLanguage === "latin") {
      detectedLanguage = guessLatinLanguage(transcript) ?? "latin";
    }
    const languageMismatch =
      detectedLanguage !== "unknown" &&
      detectedLanguage !== "latin"   &&
      detectedLanguage !== langCode;

    return new Response(
      JSON.stringify({
        transcript,
        confidence,
        requestedLanguage: langCode,
        detectedLanguage,
        detectedScript: script.script,
        languageMismatch,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("transcribe-audio error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erreur serveur" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
