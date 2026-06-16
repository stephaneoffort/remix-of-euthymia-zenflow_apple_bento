import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useAudioSync } from '@/hooks/useAudioSync';
import { WifiOff, RefreshCw, CheckCircle2, Mic } from 'lucide-react';
import { flushQueue, getQueuedCount } from '@/lib/offlineQueue';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const queryClient = useQueryClient();

  const { audioPending, audioSyncing } = useAudioSync();

  const refreshCount = useCallback(async () => {
    try {
      const count = await getQueuedCount();
      setQueuedCount(count);
    } catch { /* IndexedDB unavailable */ }
  }, []);

  // Poll queue count when offline
  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 3000);
    return () => clearInterval(interval);
  }, [refreshCount]);

  // Auto-sync mutations when back online
  useEffect(() => {
    if (isOnline && queuedCount > 0 && !syncing) {
      const sync = async () => {
        setSyncing(true);
        const { synced, failed } = await flushQueue();
        setSyncing(false);
        await refreshCount();
        if (synced > 0) {
          toast.success(`${synced} modification${synced > 1 ? 's' : ''} synchronisée${synced > 1 ? 's' : ''}`);
          queryClient.invalidateQueries();
          setJustSynced(true);
          setTimeout(() => setJustSynced(false), 3000);
        }
        if (failed > 0) {
          toast.error(`${failed} modification${failed > 1 ? 's' : ''} en échec — réessayez`);
        }
      };
      sync();
    }
  }, [isOnline, queuedCount, syncing, refreshCount, queryClient]);

  const isSyncing = syncing || audioSyncing;
  const totalPending = queuedCount + audioPending;
  const shouldHide = isOnline && !isSyncing && !justSynced && totalPending === 0;

  if (shouldHide) return null;

  return (
    <div
      className={[
        'fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium',
        'animate-in slide-in-from-top duration-300',
        justSynced
          ? 'bg-primary text-primary-foreground'
          : isSyncing
            ? 'bg-accent text-accent-foreground'
            : 'bg-destructive text-destructive-foreground',
      ].join(' ')}
    >
      {justSynced ? (
        <>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Toutes les modifications ont été synchronisées
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
          {audioSyncing
            ? `Transcription audio en cours…${audioPending > 1 ? ` (${audioPending})` : ''}`
            : 'Synchronisation en cours…'}
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Mode hors-ligne</span>
          {queuedCount > 0 && (
            <span data-numeric className="font-numeric tabular-nums">
              {` — ${queuedCount} modification${queuedCount > 1 ? 's' : ''}`}
            </span>
          )}
          {audioPending > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <Mic className="w-3.5 h-3.5 shrink-0" />
              {audioPending} enregistrement{audioPending > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs opacity-75">en attente</span>
        </>
      )}
    </div>
  );
}
