import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

const db = supabase as any;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available
  }
}

interface UnreadCounts {
  [id: string]: number;
}

export function useChatNotifications() {
  const { user } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const location = useLocation();
  const isOnChatPage = location.pathname === '/chat';

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
  const totalDmUnread = 0;
  const dmUnreadCounts: UnreadCounts = {};

  const refreshUnreadCounts = useCallback(async () => {
    if (!user) return;

    const { data: channels } = await db.from('chat_channels').select('id');
    if (!channels) return;

    const { data: memberships } = await db
      .from('chat_channel_members')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id);

    const readMap: Record<string, string> = {};
    memberships?.forEach((m: any) => {
      readMap[m.channel_id] = m.last_read_at;
    });

    const counts: UnreadCounts = {};
    for (const ch of channels) {
      const lastRead = readMap[ch.id];
      let query = db
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', ch.id)
        .eq('is_deleted', false)
        .neq('user_id', user.id);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count } = await query;
      if (count && count > 0) {
        counts[ch.id] = count;
      }
    }

    setUnreadCounts(counts);
  }, [user]);

  const refreshDmUnreadCounts = useCallback(async () => {
    // DMs will use same channel system with type='dm'
  }, []);

  useEffect(() => {
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  const markCategoryRead = useCallback(async (channelId: string) => {
    if (!user) return;
    await db.from('chat_channel_members').upsert({
      channel_id: channelId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'channel_id,user_id' });

    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[channelId];
      return next;
    });
  }, [user]);

  const markDmRead = useCallback(async (_conversationId: string) => {
    // Will use markCategoryRead with DM channel ID
  }, []);

  // Realtime subscription for new messages notification
  useEffect(() => {
    const channel = supabase
      .channel('chat-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user?.id) return;

        // If not on chat page, show toast
        if (!isOnChatPage) {
          playNotificationSound();
          toast('💬 Nouveau message', {
            description: msg.content?.slice(0, 80),
            action: {
              label: 'Voir',
              onClick: () => { window.location.href = '/chat'; },
            },
          });
        }

        // Increment unread
        setUnreadCounts(prev => ({
          ...prev,
          [msg.channel_id]: (prev[msg.channel_id] || 0) + 1,
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isOnChatPage]);

  return {
    unreadCounts,
    dmUnreadCounts,
    totalUnread,
    totalDmUnread,
    refreshUnreadCounts,
    refreshDmUnreadCounts,
    markCategoryRead,
    markDmRead,
  };
}
