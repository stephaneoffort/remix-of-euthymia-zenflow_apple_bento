import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations, type IntegrationKey, type IntegrationStatus } from "@/hooks/useIntegrations";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Wrapper "single provider" autour de useIntegrations.
 * Expose une API simple pour la page IntegrationsPage.
 */
export function useIntegration(provider: IntegrationKey) {
  const { integrations, loading, disconnect: disconnectAll } = useIntegrations();
  const [working, setWorking] = useState(false);

  const status: IntegrationStatus | undefined = useMemo(
    () => integrations?.[provider],
    [integrations, provider],
  );

  const connect = useCallback(async () => {
    setWorking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        window.location.href = "/auth";
        return;
      }
      // Appel direct à l'edge function /authorize qui redirige vers l'OAuth provider.
      const url = `${SUPABASE_URL}/functions/v1/integration-oauth/authorize?provider=${provider}`;
      // On utilise un POST via form pour pouvoir transmettre le token Authorization,
      // mais le plus simple : ouvrir un popup avec le token dans le hash, sinon rediriger.
      // Ici on fait un fetch pour déclencher l'auth puis on suit la redirection manuellement.
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        redirect: "manual",
      });
      // Avec redirect:manual, on récupère 0/opaqueredirect : on doit rediriger côté client.
      // Solution : appel sans redirect manuel pour suivre, OU on construit l'URL directement.
      if (res.type === "opaqueredirect" || res.status === 0) {
        // Fallback : on ouvre l'URL dans la fenêtre courante (le serveur renverra un 302 vers le provider OAuth).
        window.location.href = url + `&access_token=${encodeURIComponent(token)}`;
      } else if (res.redirected) {
        window.location.href = res.url;
      } else {
        window.location.href = url;
      }
    } finally {
      setWorking(false);
    }
  }, [provider]);

  const disconnect = useCallback(async () => {
    setWorking(true);
    try {
      await disconnectAll(provider);
    } finally {
      setWorking(false);
    }
  }, [provider, disconnectAll]);

  return { status, loading, working, connect, disconnect };
}
