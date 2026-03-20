import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

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
  const { teamMemberId } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [dmUnreadCounts, setDmUnreadCounts] = useState<UnreadCounts>({});
  const location = useLocation();
  const isOnChatPage = location.pathname === '/chat';
  const membersCache = useRef<Record<string, string>>({});

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);
  const totalDmUnread = Object.values(dmUnreadCounts).reduce((sum, c) => sum + c, 0);

  // Fetch team members once for name lookup
  useEffect(() => {
    supabase.from('team_members').select('id, name').then(({ data }) => {
      if (data) {
        data.forEach(m => { membersCache.current[m.id] = m.name; });
      }
    });
  }, []);

  // Compute unread counts for channels
  const refreshUnreadCounts = useCallback(async () => {
    if (!teamMemberId) return;

    const { data: categories } = await supabase.from('chat_categories').select('id');
    if (!categories) return;

    const { data: readStatuses } = await supabase
      .from('chat_read_status')
      .select('category_id, last_read_at')
      .eq('member_id', teamMemberId);

    const readMap: Record<string, string> = {};
    readStatuses?.forEach(rs => {
      readMap[rs.category_id] = rs.last_read_at;
    });

    const counts: UnreadCounts = {};
    for (const cat of categories) {
      const lastRead = readMap[cat.id];
      let query = supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', cat.id)
        .neq('author_id', teamMemberId);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count } = await query;
      if (count && count > 0) {
        counts[cat.id] = count;
      }
    }

    setUnreadCounts(counts);
  }, [teamMemberId]);

  // Compute unread counts for DMs
  const refreshDmUnreadCounts = useCallback(async () => {
    if (!teamMemberId) return;

    // Get conversations this member is in
    const { data: myConvos } = await supabase
      .from('direct_conversation_members')
      .select('conversation_id')
      .eq('member_id', teamMemberId);
    if (!myConvos || myConvos.length === 0) { setDmUnreadCounts({}); return; }

    // Get read statuses
    const convoIds = myConvos.map(c => c.conversation_id);
    const { data: readStatuses } = await supabase
      .from('dm_read_status')
      .select('conversation_id, last_read_at')
      .eq('member_id', teamMemberId)
      .in('conversation_id', convoIds);

    const readMap: Record<string, string> = {};
    readStatuses?.forEach(rs => {
      readMap[rs.conversation_id] = rs.last_read_at;
    });

    const counts: UnreadCounts = {};
    for (const convoId of convoIds) {
      const lastRead = readMap[convoId];
      let query = supabase
        .from('direct_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', convoId)
        .neq('author_id', teamMemberId);

      if (lastRead) {
        query = query.gt('created_at', lastRead);
      }

      const { count } = await query;
      if (count && count > 0) {
        counts[convoId] = count;
      }
    }

    setDmUnreadCounts(counts);
  }, [teamMemberId]);

  // Initial fetch
  useEffect(() => {
    refreshUnreadCounts();
    refreshDmUnreadCounts();
  }, [refreshUnreadCounts, refreshDmUnreadCounts]);

  // Mark a category as read
  const markCategoryRead = useCallback(async (categoryId: string) => {
    if (!teamMemberId) return;

    await supabase
      .from('chat_read_status')
      .upsert(
        { member_id: teamMemberId, category_id: categoryId, last_read_at: new Date().toISOString() },
        { onConflict: 'member_id,category_id' }
      );

    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }, [teamMemberId]);

  // Mark a DM conversation as read
  const markConversationRead = useCallback(async (conversationId: string) => {
    if (!teamMemberId) return;

    await supabase
      .from('dm_read_status')
      .upsert(
        { member_id: teamMemberId, conversation_id: conversationId, last_read_at: new Date().toISOString() },
        { onConflict: 'member_id,conversation_id' }
      );

    setDmUnreadCounts(prev => {
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, [teamMemberId]);

  // Subscribe to new chat messages for toast notifications
  useEffect(() => {
    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { author_id: string; content: string; category_id: string };
          if (msg.author_id === teamMemberId) return;

          setUnreadCounts(prev => ({
            ...prev,
            [msg.category_id]: (prev[msg.category_id] || 0) + 1,
          }));

          playNotificationSound();

          if (!isOnChatPage) {
            const authorName = membersCache.current[msg.author_id] || 'Quelqu\'un';
            const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;

            toast(authorName, {
              description: preview,
              duration: 4000,
              action: {
                label: 'Voir',
                onClick: () => { window.location.href = '/chat'; },
              },
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages' },
        (payload) => {
          const msg = payload.new as { author_id: string; content: string; conversation_id: string };
          if (msg.author_id === teamMemberId) return;

          setDmUnreadCounts(prev => ({
            ...prev,
            [msg.conversation_id]: (prev[msg.conversation_id] || 0) + 1,
          }));

          playNotificationSound();

          if (!isOnChatPage) {
            const authorName = membersCache.current[msg.author_id] || 'Quelqu\'un';
            const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;

            toast(`✉️ ${authorName}`, {
              description: preview,
              duration: 4000,
              action: {
                label: 'Voir',
                onClick: () => { window.location.href = '/chat'; },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamMemberId, isOnChatPage]);

  return {
    unreadCounts,
    dmUnreadCounts,
    totalUnread: totalUnread + totalDmUnread,
    totalDmUnread,
    markCategoryRead,
    markConversationRead,
    refreshUnreadCounts,
    refreshDmUnreadCounts,
  };
}
