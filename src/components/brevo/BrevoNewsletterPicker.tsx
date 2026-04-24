import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Mail, Link, ExternalLink } from 'lucide-react';
import { useBrevo } from '@/hooks/useBrevo';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  onLinked?: () => void;
}

interface Campaign {
  id: number;
  name: string;
  subject: string;
  status: string;
  sent_date: string | null;
  open_rate: number | null;
  share_link: string | null;
}

export default function BrevoNewsletterPicker({ open, onClose, entityType, entityId, onLinked }: Props) {
  const { listNewsletters, linkNewsletter } = useBrevo();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      listNewsletters()
        .then(data => setCampaigns(data))
        .catch(() => toast.error('Erreur lors du chargement des newsletters'))
        .finally(() => setLoading(false));
    }
  }, [open, listNewsletters]);

  const handleLinkCampaign = async (c: Campaign) => {
    setLinking(c.id);
    try {
      await linkNewsletter({
        entity_type: entityType,
        entity_id: entityId,
        campaign_id: c.id,
        campaign_name: c.name,
        campaign_url: c.share_link ?? undefined,
        label: c.name,
      });
      toast.success('Newsletter liée ✅');
      onLinked?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLinking(null);
    }
  };

  const handleLinkCustom = async () => {
    if (!customUrl.trim()) return;
    setSavingCustom(true);
    try {
      await linkNewsletter({
        entity_type: entityType,
        entity_id: entityId,
        custom_url: customUrl.trim(),
        label: customLabel.trim() || 'Newsletter',
      });
      toast.success('Lien ajouté ✅');
      setCustomLabel('');
      setCustomUrl('');
      onLinked?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSavingCustom(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Lier une newsletter
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="brevo" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="brevo">Mes newsletters Brevo</TabsTrigger>
            <TabsTrigger value="custom">Lien personnalisé</TabsTrigger>
          </TabsList>

          <TabsContent value="brevo" className="flex-1 overflow-y-auto space-y-2 mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucune newsletter trouvée dans votre compte Brevo.
              </p>
            ) : (
              campaigns.map(c => (
                <div key={c.id} className="border border-border rounded-lg p-3 space-y-1.5 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <Badge variant={c.status === 'sent' ? 'default' : 'secondary'} className="text-[10px] shrink-0 mt-0.5">
                      {c.status === 'sent' ? 'Envoyée' : 'Brouillon'}
                    </Badge>
                    <span className="text-sm font-medium text-foreground flex-1">{c.name}</span>
                  </div>
                  {c.subject && (
                    <p className="text-xs text-muted-foreground">Sujet : {c.subject}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {c.sent_date && (
                      <span>Envoyée le {format(new Date(c.sent_date), 'd MMM yyyy', { locale: fr })}</span>
                    )}
                    {c.open_rate != null && (
                      <span data-numeric className="font-numeric tabular-nums">Taux ouverture : {(c.open_rate * 100).toFixed(0)}%</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs mt-1"
                    disabled={linking === c.id}
                    onClick={() => handleLinkCampaign(c)}
                  >
                    {linking === c.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link className="w-3 h-3 mr-1" />}
                    Lier cette newsletter
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="nl-label" className="text-sm">Nom de la newsletter</Label>
              <Input
                id="nl-label"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="Newsletter Euthymia - Avril 2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nl-url" className="text-sm">Lien vers la newsletter</Label>
              <Input
                id="nl-url"
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <Button
              onClick={handleLinkCustom}
              disabled={savingCustom || !customUrl.trim()}
              className="w-full"
            >
              {savingCustom ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link className="w-4 h-4 mr-2" />}
              Ajouter ce lien
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
