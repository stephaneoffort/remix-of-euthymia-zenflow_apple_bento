import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X, ExternalLink } from 'lucide-react';
import { useGoogleDrive, type DriveAttachment } from '@/hooks/useGoogleDrive';
import { getDriveIcon } from '@/components/drive/DriveFilePicker';
import DriveFilePicker from '@/components/drive/DriveFilePicker';
import { toast } from 'sonner';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface DriveAttachmentsProps {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  compact?: boolean;
}

export default function DriveAttachments({ entityType, entityId, compact }: DriveAttachmentsProps) {
  const { isActive } = useIntegrations();
  const drive = useGoogleDrive();
  const [attachments, setAttachments] = useState<DriveAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await drive.listAttachments(entityType, entityId);
      setAttachments(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  if (!isActive('google_drive')) return null;

  const handleDetach = async (att: DriveAttachment) => {
    try {
      await drive.detachFile(att.id);
      setAttachments(prev => prev.filter(a => a.id !== att.id));
      toast.success('Fichier détaché');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  if (!drive.isConnected && attachments.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={`font-medium text-foreground flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
            <img src={INTEGRATION_CONFIG.google_drive.icon} alt="Google Drive" className="w-5 h-5" /> Google Drive
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-2"
          onClick={drive.connect}
        >
          <img src={INTEGRATION_CONFIG.google_drive.icon} alt="" className="w-4 h-4" /> Connecter Google Drive
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className={`font-medium text-foreground flex items-center gap-1.5 ${compact ? 'text-xs' : 'text-sm'}`}>
          <img src={INTEGRATION_CONFIG.google_drive.icon} alt="Google Drive" className="w-5 h-5" /> Google Drive
        </p>
        {drive.isConnected && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setPickerOpen(true)}
          >
            <Plus className="w-3 h-3" /> Joindre
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun fichier Drive joint</p>
      ) : (
        <div className="space-y-1">
          {attachments.map(att => (
            <div
              key={att.id}
              className="group flex items-center gap-2 p-2 rounded-lg border border-border hover:border-primary/20 bg-muted/20 transition-colors"
            >
              {getDriveIcon(att.mime_type)}
              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm font-medium text-foreground hover:text-primary truncate transition-colors"
              >
                {att.file_name}
              </a>
              {att.file_size && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatSize(att.file_size)}
                </span>
              )}
              <a
                href={att.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all"
              >
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
              <button
                onClick={() => handleDetach(att)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all"
              >
                <X className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}

      <DriveFilePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        entityType={entityType}
        entityId={entityId}
        onAttached={fetchAttachments}
      />
    </div>
  );
}
