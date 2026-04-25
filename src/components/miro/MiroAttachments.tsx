import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X, ExternalLink } from 'lucide-react';
import { useMiro, type MiroAttachment } from '@/hooks/useMiro';
import MiroBoardPicker from './MiroBoardPicker';
import { toast } from 'sonner';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';

interface Props {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  compact?: boolean;
  defaultTitle?: string;
}

export default function MiroAttachments({ entityType, entityId, defaultTitle }: Props) {
  const { isActive } = useIntegrations();
  const miro = useMiro();
  const [attachments, setAttachments] = useState<MiroAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await miro.listAttachments(entityType, entityId);
      setAttachments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [entityType, entityId, miro]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  if (!isActive('miro')) return null;

  const handleDetach = async (att: MiroAttachment) => {
    try {
      await miro.detachAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success('Board détaché');
    } catch {
      toast.error('Erreur lors du détachement');
    }
  };

  // Pas connecté et aucun board attaché → CTA connexion
  if (!miro.isConnected && attachments.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.miro.icon} alt="Miro" className="w-5 h-5" loading="lazy" /> Miro
        </p>
        <Button variant="outline" size="sm" onClick={miro.connect} className="gap-1.5 text-xs">
          <img src={INTEGRATION_CONFIG.miro.icon} alt="" className="w-4 h-4" loading="lazy" /> Connecter Miro
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.miro.icon} alt="Miro" className="w-5 h-5" loading="lazy" /> Miro
        </p>
        {miro.isConnected && (
          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="h-6 px-2 text-xs gap-1">
            <Plus className="w-3 h-3" /> Board
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : attachments.length === 0 ? (
        miro.isConnected ? <p className="text-xs text-muted-foreground italic">Aucun board attaché</p> : null
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
              {att.thumbnail_url ? (
                <img src={att.thumbnail_url} alt={att.board_name} className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-8 h-8 rounded bg-[#FFD02F]/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-[#FFD02F]">M</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{att.board_name}</p>
                {att.board_description && (
                  <p className="text-[10px] text-muted-foreground truncate">{att.board_description}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.board_url && (
                  <button onClick={() => window.open(att.board_url, '_blank')} className="p-1 rounded hover:bg-muted" title="Ouvrir dans Miro">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                <button onClick={() => handleDetach(att)} className="p-1 rounded hover:bg-muted" title="Détacher">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MiroBoardPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        entityType={entityType}
        entityId={entityId}
        defaultTitle={defaultTitle}
        onAttached={fetchAttachments}
      />
    </div>
  );
}
