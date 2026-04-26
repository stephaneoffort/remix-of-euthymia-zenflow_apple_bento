import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DROPBOX_API_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/dropbox-api`;
const DROPBOX_OAUTH_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/dropbox-oauth/authorize`;

export interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_display: string;
  path_lower?: string;
  size?: number;
  client_modified?: string;
  server_modified?: string;
}

export interface DropboxAttachment {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  file_id: string;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  file_size: number | null;
  is_folder: boolean;
  thumbnail_url: string | null;
  created_at: string;
}

export function useDropbox() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsConnected(false); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from('dropbox_connections')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    setIsConnected((data?.length ?? 0) > 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    checkConnection();
    if (window.location.search.includes("dropbox_connected=true")) {
      setIsConnected(true);
      checkConnection();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [checkConnection]);

  const connect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Vous devez être connecté'); return; }
    window.location.href = `${DROPBOX_OAUTH_URL}?user_id=${user.id}`;
  }, []);

  const disconnect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('dropbox_connections').delete().eq('user_id', user.id);
    await (supabase as any).from('member_integrations').update({
      is_connected: false,
      connected_at: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('integration', 'dropbox');
    setIsConnected(false);
    toast.success('Compte Dropbox déconnecté');
  }, []);

  const callApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const res = await fetch(DROPBOX_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Dropbox API error (${res.status})`);
    }
    return res.json();
  }, []);

  const listFolder = useCallback((path: string = ''): Promise<DropboxEntry[]> =>
    callApi('list_folder', { path }), [callApi]);

  const search = useCallback((query: string): Promise<DropboxEntry[]> =>
    callApi('search', { query }), [callApi]);

  const attachFile = useCallback((file: DropboxEntry, entityType: string, entityId: string) =>
    callApi('attach', { file, entity_type: entityType, entity_id: entityId }), [callApi]);

  const createFolder = useCallback((path: string) =>
    callApi('create_folder', { path }), [callApi]);

  const listAttachments = useCallback((entityType: string, entityId: string): Promise<DropboxAttachment[]> =>
    callApi('list_attachments', { entity_type: entityType, entity_id: entityId }), [callApi]);

  const detachAttachment = useCallback((attachmentId: string) =>
    callApi('detach', { attachment_id: attachmentId }), [callApi]);

  return {
    isConnected,
    loading,
    connect,
    disconnect,
    listFolder,
    search,
    attachFile,
    createFolder,
    listAttachments,
    detachAttachment,
    refetch: checkConnection,
  };
}
