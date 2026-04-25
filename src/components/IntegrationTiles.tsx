import React, { useState, useEffect } from 'react';
import { useIntegrations, INTEGRATION_CONFIG, type IntegrationKey } from '@/hooks/useIntegrations';
import { useGoogleDrive } from '@/hooks/useGoogleDrive';
import { useCanva } from '@/hooks/useCanva';
import { useZoom } from '@/hooks/useZoom';
import { useBrevo } from '@/hooks/useBrevo';
import DriveAttachments from '@/components/drive/DriveAttachments';
import CanvaAttachments from '@/components/canva/CanvaAttachments';
import ZoomMeetings from '@/components/zoom/ZoomMeetings';
import BrevoNewsletterLinks from '@/components/brevo/BrevoNewsletterLinks';
import GmailCompose from '@/components/gmail/GmailCompose';
import MiroAttachments from '@/components/miro/MiroAttachments';
import DropboxAttachments from '@/components/dropbox/DropboxAttachments';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  taskTitle?: string;
}

interface TileConfig {
  key: string;
  integration: IntegrationKey;
  label: string;
  icon: string;
}

const TILES: TileConfig[] = [
  { key: 'drive', integration: 'google_drive', label: 'Drive', icon: INTEGRATION_CONFIG.google_drive.icon },
  { key: 'dropbox', integration: 'dropbox', label: 'Dropbox', icon: INTEGRATION_CONFIG.dropbox.icon },
  { key: 'canva', integration: 'canva', label: 'Canva', icon: INTEGRATION_CONFIG.canva.icon },
  { key: 'miro', integration: 'miro', label: 'Miro', icon: INTEGRATION_CONFIG.miro.icon },
  { key: 'zoom', integration: 'zoom', label: 'Zoom', icon: INTEGRATION_CONFIG.zoom.icon },
  { key: 'newsletter', integration: 'brevo', label: 'Newsletter', icon: INTEGRATION_CONFIG.brevo.icon },
  { key: 'email', integration: 'gmail', label: 'Email', icon: INTEGRATION_CONFIG.brevo.icon },
];

export default function IntegrationTiles({ entityType, entityId, taskTitle }: Props) {
  const { isActive } = useIntegrations();
  const [openTile, setOpenTile] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Fetch counts
  useEffect(() => {
    if (!entityId) return;
    const fetchCounts = async () => {
      const newCounts: Record<string, number> = {};

      if (isActive('google_drive')) {
        try {
          const { count } = await supabase
            .from('drive_attachments')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.drive = count || 0;
        } catch { newCounts.drive = 0; }
      }

      if (isActive('canva')) {
        try {
          const { count } = await supabase
            .from('canva_attachments')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.canva = count || 0;
        } catch { newCounts.canva = 0; }
      }

      if (isActive('zoom')) {
        try {
          const { count } = await supabase
            .from('zoom_meetings')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.zoom = count || 0;
        } catch { newCounts.zoom = 0; }
      }

      if (isActive('brevo')) {
        try {
          const { count } = await supabase
            .from('brevo_entity_campaigns')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.newsletter = count || 0;
        } catch { newCounts.newsletter = 0; }
      }

      if (isActive('miro')) {
        try {
          const { count } = await (supabase as any)
            .from('miro_attachments')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.miro = count || 0;
        } catch { newCounts.miro = 0; }
      }

      if (isActive('dropbox')) {
        try {
          const { count } = await (supabase as any)
            .from('dropbox_attachments')
            .select('*', { count: 'exact', head: true })
            .eq('entity_type', entityType)
            .eq('entity_id', entityId);
          newCounts.dropbox = count || 0;
        } catch { newCounts.dropbox = 0; }
      }

      newCounts.email = 0; // Email compose has no stored count
      setCounts(newCounts);
    };
    fetchCounts();
  }, [entityId, entityType, isActive]);

  const activeTiles = TILES.filter(t => isActive(t.integration));
  if (activeTiles.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Tiles row */}
      <div className="flex flex-wrap gap-2">
        {activeTiles.map(tile => {
          const count = counts[tile.key] ?? 0;
          const isOpen = openTile === tile.key;
          return (
            <button
              key={tile.key}
              onClick={() => setOpenTile(isOpen ? null : tile.key)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all
                ${isOpen
                  ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                  : 'border-border bg-muted/30 text-foreground hover:bg-muted/60 hover:border-border/80'
                }
              `}
            >
              <img src={tile.icon} alt={tile.label} className="w-4 h-4" />
              <span>{tile.label}</span>
              {count > 0 && (
                <span className={`
                  min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold
                  ${isOpen ? 'bg-primary text-primary-foreground' : 'bg-foreground/15 text-foreground/70'}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded content */}
      {openTile === 'drive' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <DriveAttachments entityType={entityType} entityId={entityId} compact />
        </div>
      )}
      {openTile === 'canva' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <CanvaAttachments entityType={entityType} entityId={entityId} compact defaultTitle={taskTitle} />
        </div>
      )}
      {openTile === 'zoom' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <ZoomMeetings entityType={entityType} entityId={entityId} compact defaultTitle={taskTitle} />
        </div>
      )}
      {openTile === 'miro' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <MiroAttachments entityType={entityType} entityId={entityId} compact defaultTitle={taskTitle} />
        </div>
      )}
      {openTile === 'dropbox' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <DropboxAttachments entityType={entityType} entityId={entityId} compact />
        </div>
      )}
      {openTile === 'newsletter' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <BrevoNewsletterLinks entityType={entityType} entityId={entityId} compact />
        </div>
      )}
      {openTile === 'email' && (
        <div className="border border-border rounded-lg p-3 bg-background/50">
          <GmailCompose entityType={entityType} entityId={entityId} defaultSubject={taskTitle} compact />
        </div>
      )}
    </div>
  );
}
