import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { INTEGRATION_CONFIG, type IntegrationKey } from '@/hooks/useIntegrations';

interface MemberIntegrations {
  user_id: string;
  name: string;
  email: string;
  integrations: Record<string, { is_enabled: boolean; is_connected: boolean }>;
}

const DISPLAY_KEYS: IntegrationKey[] = ['google_drive', 'zoom', 'canva', 'google_meet', 'gmail', 'brevo'];

export default function AdminIntegrationsPanel() {
  const [data, setData] = useState<MemberIntegrations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/admin-integrations`;

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          const err = await res.json();
          setError(err.error || 'Erreur');
          setLoading(false);
          return;
        }

        setData(await res.json());
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          Intégrations de l'équipe
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Vue d'ensemble en lecture seule — aucune donnée privée (tokens, clés) n'est exposée.
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre n'a configuré d'intégration.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-medium text-muted-foreground">Membre</th>
                  {DISPLAY_KEYS.map(k => (
                    <th key={k} className="text-center py-2 px-1 font-medium text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <img src={INTEGRATION_CONFIG[k].icon} alt="" className="w-5 h-5 rounded" />
                        <span className="text-[10px] leading-tight">{INTEGRATION_CONFIG[k].label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(member => (
                  <tr key={member.user_id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-2">
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </td>
                    {DISPLAY_KEYS.map(k => {
                      const status = member.integrations[k];
                      const active = status?.is_enabled && status?.is_connected;
                      const enabledOnly = status?.is_enabled && !status?.is_connected;

                      return (
                        <td key={k} className="text-center py-3 px-1">
                          {active ? (
                            <Badge variant="default" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30 text-[10px] px-1.5">
                              ✅ Actif
                            </Badge>
                          ) : enabledOnly ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-400/50 text-[10px] px-1.5">
                              ⚠️ Activé
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
