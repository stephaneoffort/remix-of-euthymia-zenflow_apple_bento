import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { useBrevo } from '@/hooks/useBrevo';
import { useIntegrations } from '@/hooks/useIntegrations';
import { toast } from 'sonner';
import BrevoNewsletterPicker from './BrevoNewsletterPicker';

interface Props {
  entityType: string;
  entityId: string;
  compact?: boolean;
}

interface LinkedNewsletter {
  id: string;
  campaign_id: number | null;
  campaign_name: string | null;
  campaign_url: string | null;
  custom_url: string | null;
  label: string | null;
  created_at: string;
}

export default function BrevoNewsletterLinks({ entityType, entityId, compact }: Props) {
  const { isActive } = useIntegrations();
  const { getLinkedNewsletters, unlinkNewsletter } = useBrevo();
  const [links, setLinks] = useState<LinkedNewsletter[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const fetchLinks = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await getLinkedNewsletters(entityType, entityId);
      setLinks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, getLinkedNewsletters]);

  useEffect(() => {
    if (isActive('brevo') && entityId) fetchLinks();
  }, [isActive, entityId, fetchLinks]);

  if (!isActive('brevo')) return null;

  const handleUnlink = async (linkId: string) => {
    try {
      await unlinkNewsletter(linkId);
      setLinks(prev => prev.filter(l => l.id !== linkId));
      toast.success('Newsletter retirée');
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const openUrl = (link: LinkedNewsletter) => {
    const url = link.campaign_url || link.custom_url;
    if (url) window.open(url, '_blank');
  };

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">Newsletters</span>
          {links.length > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {links.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="w-3 h-3" />
          Lier
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && links.length === 0 && (
        <p className="text-[11px] text-muted-foreground pl-5">Aucune newsletter liée</p>
      )}

      {links.map(link => (
        <div
          key={link.id}
          className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs group hover:bg-muted/30 transition-colors"
        >
          <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-foreground truncate block">
              {link.label || link.campaign_name || 'Newsletter'}
            </span>
            {link.campaign_id && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5">
                Brevo #{link.campaign_id}
              </Badge>
            )}
          </div>
          {(link.campaign_url || link.custom_url) && (
            <button
              onClick={() => openUrl(link)}
              className="p-1 rounded hover:bg-muted shrink-0"
              title="Voir la newsletter"
            >
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
          <button
            onClick={() => handleUnlink(link.id)}
            className="p-1 rounded hover:bg-destructive/10 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Retirer"
          >
            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ))}

      <BrevoNewsletterPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        entityType={entityType}
        entityId={entityId}
        onLinked={fetchLinks}
      />
    </div>
  );
}
