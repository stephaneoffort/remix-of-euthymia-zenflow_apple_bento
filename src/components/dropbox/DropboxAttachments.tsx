import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X, ExternalLink, Folder, FileText } from 'lucide-react';
import { useDropbox, type DropboxAttachment } from '@/hooks/useDropbox';
import DropboxFilePicker from './DropboxFilePicker';
import { toast } from 'sonner';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';

interface Props {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  compact?: boolean;
}

export default function DropboxAttachments({ entityType, entityId }: Props) {
  const { isActive } = useIntegrations();
  const dropbox = useDropbox();
  const [attachments, setAttachments] = useState<DropboxAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await dropbox.listAttachments(entityType, entityId);
      setAttachments(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [entityType, entityId, dropbox]);

  useEffect(() => { fetchAttachments(); }, [fetchAttachments]);

  if (!isActive('dropbox')) return null;

  const handleDetach = async (att: DropboxAttachment) => {
    try {
      await dropbox.detachAttachment(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success('Fichier détaché');
    } catch {
      toast.error('Erreur lors du détachement');
    }
  };

  if (!dropbox.isConnected && attachments.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.dropbox.icon} alt="Dropbox" className="w-5 h-5" loading="lazy" /> Dropbox
        </p>
        <Button variant="outline" size="sm" onClick={dropbox.connect} className="gap-1.5 text-xs">
          <img src={INTEGRATION_CONFIG.dropbox.icon} alt="" className="w-4 h-4" loading="lazy" /> Connecter Dropbox
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.dropbox.icon} alt="Dropbox" className="w-5 h-5" loading="lazy" /> Dropbox
        </p>
        {dropbox.isConnected && (
          <Button variant="ghost" size="sm" onClick={() => setPickerOpen(true)} className="h-6 px-2 text-xs gap-1">
            <Plus className="w-3 h-3" /> Fichier
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : attachments.length === 0 ? (
        dropbox.isConnected ? <p className="text-xs text-muted-foreground italic">Aucun fichier attaché</p> : null
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
              {att.thumbnail_url ? (
                <img src={att.thumbnail_url} alt={att.file_name} className="w-8 h-8 rounded object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-8 h-8 rounded bg-[#0061FF]/10 flex items-center justify-center shrink-0">
                  {att.is_folder
                    ? <Folder className="w-4 h-4 text-[#0061FF]" />
                    : <FileText className="w-4 h-4 text-[#0061FF]" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{att.file_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{att.file_path}</p>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.file_url && (
                  <button onClick={() => window.open(att.file_url!, '_blank')} className="p-1 rounded hover:bg-muted" title="Ouvrir dans Dropbox">
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

      <DropboxFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        entityType={entityType}
        entityId={entityId}
        onAttached={fetchAttachments}
      />
    </div>
  );
}
