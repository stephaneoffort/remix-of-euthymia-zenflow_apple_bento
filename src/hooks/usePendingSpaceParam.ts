import { useEffect } from 'react';

/** Évite un double traitement si deux barres latérales sont montées */
let handled = false;

/**
 * Lit le paramètre `?space=<id>` posé par une bascule d'équipe,
 * ouvre l'espace correspondant puis nettoie l'URL.
 */
export function usePendingSpaceParam(
  openSpace: (spaceId: string) => void,
  ready: boolean = true
) {
  useEffect(() => {
    if (handled || !ready) return;
    const params = new URLSearchParams(window.location.search);
    const spaceId = params.get('space');
    if (!spaceId) return;
    handled = true;
    openSpace(spaceId);
    params.delete('space');
    const qs = params.toString();
    window.history.replaceState(
      {},
      '',
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
    );
  }, [openSpace, ready]);
}
