import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type IntegrationKey =
  | 'google_drive'
  | 'zoom'
  | 'canva'
  | 'google_meet'
  | 'gmail'
  | 'brevo'
  | 'miro';

export interface IntegrationStatus {
  key: IntegrationKey;
  is_enabled: boolean;
  is_connected: boolean;
  enabled_at: string | null;
  connected_at: string | null;
}

const ALL_INTEGRATIONS: IntegrationKey[] = [
  'google_drive', 'zoom', 'canva', 'google_meet', 'gmail', 'brevo', 'miro',
];

import googleDriveIcon from '@/assets/integrations/google-drive.png';
import zoomIcon from '@/assets/integrations/zoom.png';
import canvaIcon from '@/assets/integrations/canva.png';
import googleMeetIcon from '@/assets/integrations/google-meet.png';
import gmailIcon from '@/assets/integrations/gmail.png';
import brevoIcon from '@/assets/integrations/brevo.png';
import miroIcon from '@/assets/integrations/miro.png';

export const INTEGRATION_CONFIG: Record<IntegrationKey, {
  label: string;
  description: string;
  icon: string;
  color: string;
}> = {
  google_drive: {
    label: 'Google Drive',
    description: 'Joindre des fichiers Drive aux tâches et projets',
    icon: googleDriveIcon,
    color: '#4285F4',
  },
  zoom: {
    label: 'Zoom',
    description: 'Créer des réunions Zoom depuis les tâches',
    icon: zoomIcon,
    color: '#2D8CFF',
  },
  canva: {
    label: 'Canva',
    description: 'Créer et joindre des designs Canva',
    icon: canvaIcon,
    color: '#00C4CC',
  },
  google_meet: {
    label: 'Google Meet',
    description: 'Ajouter des liens Meet aux événements agenda',
    icon: googleMeetIcon,
    color: '#00897B',
  },
  gmail: {
    label: 'Gmail',
    description: 'Lire et envoyer des emails depuis les tâches',
    icon: gmailIcon,
    color: '#EA4335',
  },
  brevo: {
    label: 'Brevo',
    description: 'Newsletters, contacts et campagnes email',
    icon: brevoIcon,
    color: '#0092FF',
  },
  miro: {
    label: 'Miro',
    description: 'Lier des boards Miro aux tâches et projets',
    icon: miroIcon,
    color: '#FFD02F',
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

  const syncConnectionStatus = useCallback(async (userId: string) => {
    const connectionChecks: { key: IntegrationKey; table: string }[] = [
      { key: 'google_drive', table: 'drive_connections' },
      { key: 'zoom', table: 'zoom_connections' },
      { key: 'canva', table: 'canva_connections' },
      { key: 'brevo', table: 'brevo_connections' },
      { key: 'gmail', table: 'gmail_connections' },
      { key: 'miro', table: 'miro_connections' },
    ];

    for (const { key, table } of connectionChecks) {
      const { data } = await (supabase as any)
        .from(table)
        .select('id')
        .eq('user_id', userId)
        .limit(1);
      
      const hasConnection = (data?.length ?? 0) > 0;
      if (hasConnection) {
        await (supabase as any)
          .from('member_integrations')
          .update({
            is_enabled: true,
            is_connected: true,
            enabled_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('integration', key)
          .eq('is_connected', false);
      }
    }
  }, []);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    await ensureRows(user.id);
    await syncConnectionStatus(user.id);

    const { data } = await (supabase as any)
      .from('member_integrations')
      .select('*')
      .eq('user_id', user.id);

    if (data) {
      const map = {} as Record<IntegrationKey, IntegrationStatus>;
      (data as any[]).forEach((row) => {
        if (ALL_INTEGRATIONS.includes(row.integration as IntegrationKey)) {
          map[row.integration as IntegrationKey] = {
            key: row.integration,
            is_enabled: row.is_enabled,
            is_connected: row.is_connected,
            enabled_at: row.enabled_at,
            connected_at: row.connected_at,
          };
        }
      });
      ALL_INTEGRATIONS.forEach(k => {
        if (!map[k]) map[k] = defaultStatus(k);
      });
      setIntegrations(map);
    }
    setLoading(false);
  }, [ensureRows, syncConnectionStatus]);

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
      brevo: 'brevo_connections',
      gmail: 'gmail_connections',
      miro: 'miro_connections',
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
