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
  [categoryId: string]: number;
}

export function useChatNotifications() {
  const { teamMemberId } = useAuth();
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const location = useLocation();
  const isOnChatPage = location.pathname === '/chat';
  const membersCache = useRef<Record<string, string>>({});

  const totalUnread = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

  // Fetch team members once for name lookup
  useEffect(() => {
    supabase.from('team_members').select('id, name').then(({ data }) => {
      if (data) {
        data.forEach(m => { membersCache.current[m.id] = m.name; });
      }
    });
  }, []);

  // Compute unread counts from DB
  const refreshUnreadCounts = useCallback(async () => {
    if (!teamMemberId) return;

    // Get all categories
    const { data: categories } = await supabase.from('chat_categories').select('id');
    if (!categories) return;

    // Get read statuses for this member
    const { data: readStatuses } = await supabase
      .from('chat_read_status')
      .select('category_id, last_read_at')
      .eq('member_id', teamMemberId);

    const readMap: Record<string, string> = {};
    readStatuses?.forEach(rs => {
      readMap[rs.category_id] = rs.last_read_at;
    });

    // Count unread messages per category
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

  // Initial fetch
  useEffect(() => {
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

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

  // Subscribe to new chat messages for toast notifications
  useEffect(() => {
    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { author_id: string; content: string; category_id: string };

          // Don't notify for own messages
          if (msg.author_id === teamMemberId) return;

          // Increment unread count for the category
          setUnreadCounts(prev => ({
            ...prev,
            [msg.category_id]: (prev[msg.category_id] || 0) + 1,
          }));

          // Show toast only if not on chat page
          if (!isOnChatPage) {
            const authorName = membersCache.current[msg.author_id] || 'Quelqu\'un';
            const preview = msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content;

            toast(authorName, {
              description: preview,
              duration: 4000,
              action: {
                label: 'Voir',
                onClick: () => {
                  window.location.href = '/chat';
                },
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

  return { unreadCounts, totalUnread, markCategoryRead, refreshUnreadCounts };
}
