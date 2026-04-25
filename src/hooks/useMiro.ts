import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MIRO_API_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/miro-api`;
const MIRO_OAUTH_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/miro-oauth`;

export interface MiroBoard {
  id: string;
  name: string;
  description?: string;
  viewLink?: string;
  picture?: { imageURL?: string };
  createdAt?: string;
  modifiedAt?: string;
}

export interface MiroAttachment {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  board_id: string;
  board_name: string;
  board_url: string;
  thumbnail_url: string | null;
  board_description: string | null;
  created_at: string;
}

export function useMiro() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkConnection = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsConnected(false); setLoading(false); return; }
    const { data } = await (supabase as any)
      .from('miro_connections')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    setIsConnected((data?.length ?? 0) > 0);
    setLoading(false);
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  const connect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Vous devez être connecté'); return; }
    const url = `${MIRO_OAUTH_URL}?user_id=${user.id}`;
    window.location.href = url;
  }, []);

  const disconnect = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any).from('miro_connections').delete().eq('user_id', user.id);
    await (supabase as any).from('member_integrations').update({
      is_connected: false,
      connected_at: null,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id).eq('integration', 'miro');
    setIsConnected(false);
    toast.success('Compte Miro déconnecté');
  }, []);

  const callApi = useCallback(async (action: string, params: Record<string, any> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const res = await fetch(MIRO_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Miro API error (${res.status})`);
    }
    return res.json();
  }, []);

  const listBoards = useCallback((query?: string) => callApi('list_boards', query ? { query } : {}), [callApi]);

  const createBoard = useCallback((name: string, description?: string) =>
    callApi('create_board', { name, description }), [callApi]);

  const attachBoard = useCallback((boardId: string, entityType: string, entityId: string) =>
    callApi('attach', { board_id: boardId, entity_type: entityType, entity_id: entityId }), [callApi]);

  const listAttachments = useCallback((entityType: string, entityId: string): Promise<MiroAttachment[]> =>
    callApi('list_attachments', { entity_type: entityType, entity_id: entityId }), [callApi]);

  const detachAttachment = useCallback((attachmentId: string) =>
    callApi('detach', { attachment_id: attachmentId }), [callApi]);

  return {
    isConnected,
    loading,
    connect,
    disconnect,
    listBoards,
    createBoard,
    attachBoard,
    listAttachments,
    detachAttachment,
    refetch: checkConnection,
  };
}
