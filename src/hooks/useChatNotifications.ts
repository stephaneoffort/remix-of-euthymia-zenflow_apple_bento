import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

export function useChatNotifications() {
  const { teamMemberId } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const isOnChatPage = location.pathname === '/chat';
  const membersCache = useRef<Record<string, string>>({});

  // Reset unread when navigating to chat
  useEffect(() => {
    if (isOnChatPage) {
      setUnreadCount(0);
    }
  }, [isOnChatPage]);

  // Fetch team members once for name lookup
  useEffect(() => {
    supabase.from('team_members').select('id, name').then(({ data }) => {
      if (data) {
        data.forEach(m => { membersCache.current[m.id] = m.name; });
      }
    });
  }, []);

  // Subscribe to new chat messages
  useEffect(() => {
    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as { author_id: string; content: string };

          // Don't notify for own messages
          if (msg.author_id === teamMemberId) return;

          // Increment unread count if not on chat page
          if (!isOnChatPage) {
            setUnreadCount(prev => prev + 1);
          }

          // Show toast notification
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamMemberId, isOnChatPage]);

  return { unreadCount, resetUnread: () => setUnreadCount(0) };
}
