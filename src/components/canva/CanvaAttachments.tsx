import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X, ExternalLink, Download } from 'lucide-react';
import { useCanva, type CanvaAttachment } from '@/hooks/useCanva';
import CanvaDesignPicker from './CanvaDesignPicker';
import { toast } from 'sonner';
import { useIntegrations } from '@/hooks/useIntegrations';

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  presentation: { label: 'Présentation', color: 'bg-blue-500/10 text-blue-600' },
  poster: { label: 'Poster', color: 'bg-orange-500/10 text-orange-600' },
  social_media: { label: 'Social', color: 'bg-pink-500/10 text-pink-600' },
  flyer: { label: 'Flyer', color: 'bg-violet-500/10 text-violet-600' },
  doc: { label: 'Document', color: 'bg-green-500/10 text-green-600' },
};

interface Props {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  compact?: boolean;
  defaultTitle?: string;
}

export default function CanvaAttachments({ entityType, entityId, compact, defaultTitle }: Props) {
  const { isActive } = useIntegrations();
  const canva = useCanva();

  if (!isActive('canva')) return null;
  const [attachments, setAttachments] = useState<CanvaAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await canva.listAttachments(entityType, entityId);
      setAttachments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleDetach = async (att: CanvaAttachment) => {
    try {
      await canva.detachDesign(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success('Design détaché');
    } catch {
      toast.error('Erreur lors du détachement');
    }
  };

  const handleExport = async (att: CanvaAttachment) => {
    try {
      toast.info('Export en cours...');
      const result = await canva.exportDesign(att.design_id, 'png');
      if (result?.urls?.[0]) {
        window.open(result.urls[0], '_blank');
        toast.success('Export prêt !');
      } else {
        toast.info('Export lancé, vérifiez dans quelques instants.');
      }
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  // Not connected and no attachments
  if (!canva.isConnected && attachments.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🎨 Canva</p>
        <Button variant="outline" size="sm" onClick={canva.connect} className="gap-1.5 text-xs">
          <span>🎨</span> Connecter Canva
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">🎨 Canva</p>
        {canva.isConnected && (
          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="h-6 px-2 text-xs gap-1">
            <Plus className="w-3 h-3" /> Design
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ) : attachments.length === 0 ? (
        canva.isConnected ? (
          <button
            onClick={() => setPickerOpen(true)}
            className="w-full py-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            + Joindre un design Canva
          </button>
        ) : null
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
              {att.thumbnail_url ? (
                <img src={att.thumbnail_url} alt={att.design_name} className="w-8 h-8 rounded object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-[#00C4CC]/10 flex items-center justify-center shrink-0">
                  <span className="text-sm">🎨</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{att.design_name}</p>
                {att.design_type && TYPE_BADGES[att.design_type] && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_BADGES[att.design_type].color}`}>
                    {TYPE_BADGES[att.design_type].label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.design_url && (
                  <button onClick={() => window.open(att.design_url, '_blank')} className="p-1 rounded hover:bg-muted" title="Ouvrir dans Canva">
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                )}
                <button onClick={() => handleExport(att)} className="p-1 rounded hover:bg-muted" title="Exporter PNG">
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDetach(att)} className="p-1 rounded hover:bg-muted" title="Détacher">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CanvaDesignPicker
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
