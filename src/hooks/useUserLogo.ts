import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import defaultLogo from '@/assets/logo-zenflow.svg';

/** Bucket privé contenant les logos personnalisés (un dossier par utilisateur) */
export const USER_LOGOS_BUCKET = 'user-logos';

/** Logo ZenFlow par défaut, utilisé en repli */
export const ZENFLOW_LOGO = defaultLogo;

/** Contraintes de téléversement (SVG volontairement exclu : risque de script embarqué) */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Petit bus d'événements : permet aux sidebars de se rafraîchir après un changement */
const LOGO_EVENT = 'zenflow:user-logo-changed';
export function notifyUserLogoChanged() {
  window.dispatchEvent(new CustomEvent(LOGO_EVENT));
}

/**
 * Hook réutilisable exposant le logo de l'utilisateur courant.
 * Renvoie toujours une URL affichable : le logo personnalisé s'il existe,
 * sinon le logo ZenFlow par défaut.
 */
export function useUserLogo() {
  const { user } = useAuth();
  const [storedPath, setStoredPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>(ZENFLOW_LOGO);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setStoredPath(null);
      setLogoUrl(ZENFLOW_LOGO);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('logo_url')
      .eq('id', user.id)
      .maybeSingle();

    const path = (data as { logo_url?: string | null } | null)?.logo_url ?? null;
    setStoredPath(path);

    if (!path) {
      setLogoUrl(ZENFLOW_LOGO);
      setLoading(false);
      return;
    }

    // Bucket privé : on génère une URL signée de longue durée
    const { data: signed } = await supabase.storage
      .from(USER_LOGOS_BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    setLogoUrl(signed?.signedUrl ?? ZENFLOW_LOGO);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener(LOGO_EVENT, handler);
    return () => window.removeEventListener(LOGO_EVENT, handler);
  }, [load]);

  return { logoUrl, storedPath, hasCustomLogo: !!storedPath, loading, reload: load };
}
