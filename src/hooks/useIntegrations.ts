import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IntegrationKey =
  | 'google_drive'
  | 'zoom'
  | 'canva'
  | 'google_meet'
  | 'gmail'
  | 'brevo';

export interface IntegrationStatus {
  key: IntegrationKey;
  is_enabled: boolean;
  is_connected: boolean;
  enabled_at: string | null;
  connected_at: string | null;
}

const ALL_INTEGRATIONS: IntegrationKey[] = [
  'google_drive', 'zoom', 'canva', 'google_meet', 'gmail', 'brevo',
];

export const INTEGRATION_CONFIG: Record<IntegrationKey, {
  label: string;
  description: string;
  emoji: string;
  color: string;
}> = {
  google_drive: {
    label: 'Google Drive',
    description: 'Joindre des fichiers Drive aux tâches et projets',
    emoji: '📁',
    color: '#4285F4',
  },
  zoom: {
    label: 'Zoom',
    description: 'Créer des réunions Zoom depuis les tâches',
    emoji: '📹',
    color: '#2D8CFF',
  },
  canva: {
    label: 'Canva',
    description: 'Créer et joindre des designs Canva',
    emoji: '🎨',
    color: '#00C4CC',
  },
  google_meet: {
    label: 'Google Meet',
    description: 'Ajouter des liens Meet aux événements agenda',
    emoji: '🟢',
    color: '#00897B',
  },
  gmail: {
    label: 'Gmail',
    description: 'Lire et envoyer des emails depuis les tâches',
    emoji: '📧',
    color: '#EA4335',
  },
  brevo: {
    label: 'Brevo',
    description: 'Newsletters, contacts et campagnes email',
    emoji: '📨',
    color: '#0092FF',
  },
};

const defaultStatus = (key: IntegrationKey): IntegrationStatus => ({
  key,
  is_enabled: false,
  is_connected: false,
  enabled_at: null,
  connected_at: null,
});

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<Record<IntegrationKey, IntegrationStatus>>(
    () => Object.fromEntries(ALL_INTEGRATIONS.map(k => [k, defaultStatus(k)])) as any,
  );
  const [loading, setLoading] = useState(true);

  const ensureRows = useCallback(async (userId: string) => {
    // Upsert all 5 integrations for this user (idempotent)
    const rows = ALL_INTEGRATIONS.map(integration => ({
      user_id: userId,
      integration,
      is_enabled: false,
      is_connected: false,
    }));
    await (supabase as any)
      .from('member_integrations')
      .upsert(rows, { onConflict: 'user_id,integration', ignoreDuplicates: true });
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Ensure rows exist
    await ensureRows(user.id);

    const { data } = await (supabase as any)
      .from('member_integrations')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      const map = {} as Record<IntegrationKey, IntegrationStatus>;
      (data as any[]).forEach((row) => {
        map[row.integration as IntegrationKey] = {
          key: row.integration,
          is_enabled: row.is_enabled,
          is_connected: row.is_connected,
          enabled_at: row.enabled_at,
          connected_at: row.connected_at,
        };
      });
      // Fill any missing
      ALL_INTEGRATIONS.forEach(k => {
        if (!map[k]) map[k] = defaultStatus(k);
      });
      setIntegrations(map);
    }
    setLoading(false);
  }, [ensureRows]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const toggleEnabled = useCallback(async (key: IntegrationKey, enabled: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any)
      .from('member_integrations')
      .update({
        is_enabled: enabled,
        enabled_at: enabled ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('integration', key);

    setIntegrations(prev => ({
      ...prev,
      [key]: { ...prev[key], is_enabled: enabled, enabled_at: enabled ? new Date().toISOString() : null },
    }));
  }, []);

  const updateConnected = useCallback(async (key: IntegrationKey, connected: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any)
      .from('member_integrations')
      .update({
        is_connected: connected,
        connected_at: connected ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('integration', key);

    setIntegrations(prev => ({
      ...prev,
      [key]: { ...prev[key], is_connected: connected },
    }));
  }, []);

  const disconnect = useCallback(async (key: IntegrationKey) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const tableMap: Partial<Record<IntegrationKey, string>> = {
      google_drive: 'drive_connections',
      zoom: 'zoom_connections',
      canva: 'canva_connections',
    };
    const table = tableMap[key];
    if (table) {
      await (supabase as any).from(table).delete().eq('user_id', user.id);
    }
    await updateConnected(key, false);
    await toggleEnabled(key, false);
  }, [updateConnected, toggleEnabled]);

  const isActive = useCallback((key: IntegrationKey): boolean => {
    const s = integrations[key];
    if (!s) return false;
    // Google Meet doesn't need a separate connection
    if (key === 'google_meet') return s.is_enabled;
    return s.is_enabled && s.is_connected;
  }, [integrations]);

  return {
    integrations,
    loading,
    toggleEnabled,
    updateConnected,
    disconnect,
    isActive,
    refetch: fetchIntegrations,
  };
}
