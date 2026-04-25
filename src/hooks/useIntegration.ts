import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations, type IntegrationKey } from "@/hooks/useIntegrations";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const CONNECTION_TABLE: Record<string, string> = {
  google_drive: "drive_connections",
  zoom:         "zoom_connections",
  canva:        "canva_connections",
  brevo:        "brevo_connections",
  gmail:        "gmail_connections",
  miro:         "miro_connections",
  dropbox:      "dropbox_connections",
};

export interface SingleIntegrationStatus {
  connected: boolean;
  enabled: boolean;
  account_id: string | null;
  updated_at: string | null;
}

/**
 * Wrapper "single provider" autour de useIntegrations.
 * Expose une API simple { status, loading, working, connect, disconnect } pour IntegrationsPage.
 */
export function useIntegration(provider: string) {
  const { integrations, loading: loadingAll, disconnect: disconnectAll } = useIntegrations();
  const [working, setWorking] = useState(false);
  const [extra, setExtra] = useState<{ account_id: string | null; updated_at: string | null }>({
    account_id: null,
    updated_at: null,
  });

  // Récupère account_id / updated_at depuis la table de connexion spécifique au provider.
  useEffect(() => {
    let cancelled = false;
    const table = CONNECTION_TABLE[provider];
    if (!table) return;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from(table)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setExtra({
        account_id: data?.account_id ?? data?.email ?? data?.display_name ?? null,
        updated_at: data?.updated_at ?? data?.created_at ?? null,
      });
    })();

    return () => { cancelled = true; };
  }, [provider, integrations]);

  const status: SingleIntegrationStatus = useMemo(() => {
    const s = integrations?.[provider as IntegrationKey];
    return {
      connected: !!s?.is_connected,
      enabled:   !!s?.is_enabled,
      account_id: extra.account_id,
      updated_at: extra.updated_at ?? s?.connected_at ?? null,
    };
  }, [integrations, provider, extra]);

  const connect = useCallback(async () => {
    setWorking(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session ?? null;
      }
      const token = session?.access_token;
      if (!token) {
        window.location.href = "/auth";
        return;
      }
      // L'edge function /authorize lit le token Authorization puis renvoie un 302 vers le provider.
      // Comme un redirect simple ne porte pas le header, on passe par une fenêtre intermédiaire.
      const url = `${SUPABASE_URL}/functions/v1/integration-oauth/authorize?provider=${provider}&token=${encodeURIComponent(token)}`;
      window.location.href = url;
    } finally {
      setWorking(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    setWorking(true);
    try {
      await disconnectAll(provider as IntegrationKey);
      setExtra({ account_id: null, updated_at: null });
    } finally {
      setWorking(false);
    }
  }, [provider, disconnectAll]);

  return { status, loading: loadingAll, working, connect, disconnect };
}
