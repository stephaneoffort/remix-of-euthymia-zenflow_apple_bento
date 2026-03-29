import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBrevo } from '@/hooks/useBrevo';
import { useIntegrations } from '@/hooks/useIntegrations';
import { Loader2, Mail, Users, BarChart3 } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'Envoyé', variant: 'default' },
  draft: { label: 'Brouillon', variant: 'outline' },
  queued: { label: 'Planifié', variant: 'secondary' },
  suspended: { label: 'Suspendu', variant: 'destructive' },
};

export default function BrevoStats() {
  const { isActive } = useIntegrations();
  const { listCampaigns, profile } = useBrevo();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const active = isActive('brevo');

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    (async () => {
      try {
        const data = await listCampaigns();
        setCampaigns(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {}
      setLoading(false);
    })();
  }, [active]);

  if (!active) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const lastCampaign = campaigns[0];
  const totalSent = campaigns.reduce((s, c) => s + (c.statistics?.globalStats?.sent ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="text-base">📨</span> Brevo — Campagnes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <BarChart3 className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold text-foreground">
              {lastCampaign
                ? `${((lastCampaign.statistics?.globalStats?.uniqueOpens ?? 0) / Math.max(lastCampaign.statistics?.globalStats?.sent ?? 1, 1) * 100).toFixed(0)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Taux d'ouverture</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <Users className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold text-foreground">
              {profile?.plan?.[0]?.credits ?? '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">Crédits restants</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2.5 text-center">
            <Mail className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold text-foreground">{totalSent}</p>
            <p className="text-[10px] text-muted-foreground">Emails envoyés</p>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Aucune campagne</p>
        ) : (
          <div className="space-y-2">
            {campaigns.map((c: any) => {
              const sent = c.statistics?.globalStats?.sent ?? 0;
              const opens = c.statistics?.globalStats?.uniqueOpens ?? 0;
              const clicks = c.statistics?.globalStats?.uniqueClicks ?? 0;
              const openRate = sent > 0 ? (opens / sent) * 100 : 0;
              const clickRate = sent > 0 ? (clicks / sent) * 100 : 0;
              const statusInfo = STATUS_LABELS[c.status] ?? { label: c.status, variant: 'outline' as const };

              return (
                <div key={c.id} className="p-2 rounded-lg border border-border space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <Badge variant={statusInfo.variant} className="text-[10px] shrink-0">
                      {statusInfo.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={openRate} className="h-1.5 flex-1" />
                    <span className="text-[10px] text-muted-foreground w-10 text-right">
                      {openRate.toFixed(0)}% ouv.
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {clickRate.toFixed(1)}% clics · {sent} envoyés
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
