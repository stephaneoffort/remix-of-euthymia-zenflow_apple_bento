import { supabase } from '@/integrations/supabase/client';

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Send an audio Blob to the server-side transcription function.
 * Returns the transcript string (empty string if nothing was detected).
 * Throws on network or API errors.
 */
export async function transcribeAudio(blob: Blob, mimeType: string): Promise<string> {
  const base64 = await blobToBase64(blob);
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { audio: base64, mimeType, language: 'français' },
  });
  if (error) throw error;
  return (data as any)?.transcript?.trim?.() ?? '';
}
