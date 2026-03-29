import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBrevo } from '@/hooks/useBrevo';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';
import { Loader2, ChevronDown } from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sent: { label: 'Envoyé', variant: 'default' },
  draft: { label: 'Brouillon', variant: 'outline' },
  queued: { label: 'Planifié', variant: 'secondary' },
  suspended: { label: 'Suspendu', variant: 'destructive' },
};

const MAX_VISIBLE = 5;

export default function BrevoStats() {
  const { isActive } = useIntegrations();
  const { listCampaigns, profile } = useBrevo();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const active = isActive('brevo');

  useEffect(() => {
    if (!active) { setLoading(false); return; }
    (async () => {
      try {
        const data = await listCampaigns();
        setCampaigns(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, [active]);

  if (!active) return null;

  const visible = expanded ? campaigns : campaigns.slice(0, MAX_VISIBLE);
  const remaining = campaigns.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.brevo.icon} alt="Brevo" className="w-5 h-5" />
          Campagnes Email
          {campaigns.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
              {campaigns.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />
            Chargement…
          </p>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune campagne</p>
        ) : (
          <div className="space-y-1">
            {visible.map((c: any) => {
              const sent = c.statistics?.globalStats?.sent ?? 0;
              const opens = c.statistics?.globalStats?.uniqueOpens ?? 0;
              const clicks = c.statistics?.globalStats?.uniqueClicks ?? 0;
              const openRate = sent > 0 ? (opens / sent) * 100 : 0;
              const clickRate = sent > 0 ? (clicks / sent) * 100 : 0;
              const statusInfo = STATUS_LABELS[c.status] ?? { label: c.status, variant: 'outline' as const };

              return (
                <div
                  key={c.id}
                  className="w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md"
                >
                  <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                    <img src={INTEGRATION_CONFIG.brevo.icon} alt="" className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={statusInfo.variant} className="text-[10px] h-4">
                        {statusInfo.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {openRate.toFixed(0)}% ouv. · {clickRate.toFixed(1)}% clics · {sent} env.
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {remaining > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
              >
                {expanded ? (
                  <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                ) : (
                  <>+{remaining} autre{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
