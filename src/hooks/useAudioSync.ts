import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
  getPendingAudio,
  getPendingAudioCount,
  dequeueAudio,
} from '@/lib/audioQueue';
import { transcribeAudio } from '@/lib/transcribeAudio';

function saveTranscriptAsNote(transcript: string) {
  try {
    const notes: { id: string; text: string; createdAt: string }[] =
      JSON.parse(localStorage.getItem('quick_notes') ?? '[]');
    notes.unshift({
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: transcript,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('quick_notes', JSON.stringify(notes.slice(0, 50)));
  } catch {}
}

/**
 * Manages the offline audio queue: polls count, and flushes (transcribes +
 * saves as notes) when the device comes back online or on first mount if online.
 *
 * Returns { audioPending, audioSyncing } for use in the OfflineBanner.
 */
export function useAudioSync() {
  const isOnline = useOnlineStatus();
  const [audioPending, setAudioPending] = useState(0);
  const [audioSyncing, setAudioSyncing] = useState(false);
  const flushingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    try {
      setAudioPending(await getPendingAudioCount());
    } catch {}
  }, []);

  // Poll every 4 s so the banner stays accurate.
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 4000);
    return () => clearInterval(t);
  }, [refreshCount]);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const items = await getPendingAudio();
    if (items.length === 0) return;

    flushingRef.current = true;
    setAudioSyncing(true);
    let synced = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const transcript = await transcribeAudio(item.audioBlob, item.mimeType);
        if (transcript) saveTranscriptAsNote(transcript);
        await dequeueAudio(item.id);
        synced++;
      } catch (err) {
        console.error('[AudioSync] transcription failed:', err);
        failed++;
      }
    }

    flushingRef.current = false;
    setAudioSyncing(false);
    await refreshCount();

    if (synced > 0) {
      const s = synced > 1;
      toast.success(
        `${synced} enregistrement${s ? 's' : ''} hors-ligne ${s ? 'transcrits' : 'transcrit'} et sauvegardé${s ? 's' : ''} dans Notes rapides`,
        { duration: 6000 },
      );
    }
    if (failed > 0) {
      const f = failed > 1;
      toast.error(
        `${failed} enregistrement${f ? 's' : ''} audio n'${f ? 'ont' : 'a'} pas pu être transcrit${f ? 's' : ''} — réessayez`,
      );
    }
  }, [refreshCount]);

  // Auto-flush when going online (and on first mount if already online).
  useEffect(() => {
    if (isOnline) flush();
  }, [isOnline, flush]);

  return { audioPending, audioSyncing };
}
