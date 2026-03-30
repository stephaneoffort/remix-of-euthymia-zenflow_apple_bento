import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export interface AppMessage {
  id: string;
  type: 'comment' | 'chat' | 'dm' | 'google_chat';
  content: string;
  authorId: string;
  authorName: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  isRead: boolean;
  createdAt: string;
  source?: string;
}

export function useMessages() {
  const { teamMemberId } = useAuth();
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const membersCache = useRef<Record<string, string>>({});

  // Fetch team members once
  useEffect(() => {
    supabase.from('team_members').select('id, name').then(({ data }) => {
      if (data) data.forEach(m => { membersCache.current[m.id] = m.name; });
    });
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!teamMemberId) { setLoading(false); return; }
    setLoading(true);

    // 1. Comments where current member is mentioned
    const { data: comments } = await supabase
      .from('comments')
      .select('id, content, author_id, task_id, created_at, mentioned_member_ids')
      .contains('mentioned_member_ids', [teamMemberId])
      .neq('author_id', teamMemberId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get read comment IDs
    const { data: readComments } = await supabase
      .from('comment_reads')
      .select('comment_id')
      .eq('member_id', teamMemberId);

    const readSet = new Set((readComments ?? []).map(r => r.comment_id));

    // Get task titles for comments
    const taskIds = [...new Set((comments ?? []).map(c => c.task_id))];
    let taskTitleMap: Record<string, string> = {};
    if (taskIds.length > 0) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title')
        .in('id', taskIds);
      if (tasks) tasks.forEach(t => { taskTitleMap[t.id] = t.title; });
    }

    const commentMessages: AppMessage[] = (comments ?? []).map(c => ({
      id: c.id,
      type: 'comment' as const,
      content: c.content,
      authorId: c.author_id,
      authorName: membersCache.current[c.author_id] || 'Membre',
      entityType: 'task',
      entityId: c.task_id,
      entityTitle: taskTitleMap[c.task_id] || 'Tâche',
      isRead: readSet.has(c.id),
      createdAt: c.created_at,
    }));

    // 2. Google Chat mentions
    let gchatMessages: AppMessage[] = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: gchatMentions } = await (supabase as any)
          .from('google_chat_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_mention', true)
          .order('created_at', { ascending: false })
          .limit(30);

        gchatMessages = (gchatMentions ?? []).map((m: any) => ({
          id: m.id,
          type: 'google_chat' as const,
          content: m.content,
          authorId: m.sender_email || '',
          authorName: m.sender_name || 'Membre',
          entityType: 'chat',
          entityId: m.space_id || '',
          entityTitle: 'Google Chat',
          isRead: m.is_read,
          createdAt: m.created_at,
          source: 'google_chat',
        }));
      }
    } catch (e) {
      // Google Chat table might not exist yet
    }

    const allMessages = [...commentMessages, ...gchatMessages]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setMessages(allMessages);
    setUnreadCount(allMessages.filter(m => !m.isRead).length);
    setLoading(false);
  }, [teamMemberId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription with toast notifications
  useEffect(() => {
    if (!teamMemberId) return;
    const channel = supabase
      .channel('messages-sidebar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        const row = payload.new as any;
        if (row.mentioned_member_ids?.includes(teamMemberId) && row.author_id !== teamMemberId) {
          const authorName = membersCache.current[row.author_id] || 'Quelqu\'un';
          toast.info(`${authorName} t'a mentionné dans un commentaire`, {
            description: row.content?.slice(0, 80),
            action: { label: 'Voir', onClick: () => window.location.assign('/messages') },
            duration: 5000,
          });
        }
        fetchMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'google_chat_messages' }, async (payload) => {
        const row = payload.new as any;
        const { data: { user } } = await supabase.auth.getUser();
        if (user && row.user_id === user.id && row.is_mention) {
          toast.info(`${row.sender_name || 'Quelqu\'un'} t'a mentionné dans Google Chat`, {
            description: row.content?.slice(0, 80),
            action: { label: 'Voir', onClick: () => window.location.assign('/messages') },
            duration: 5000,
          });
        }
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, fetchMessages]);

  const markAsRead = useCallback(async (messageId: string, type?: string) => {
    if (!teamMemberId) return;

    if (type === 'google_chat') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any)
          .from('google_chat_messages')
          .update({ is_read: true })
          .eq('id', messageId)
          .eq('user_id', user.id);
      }
    } else {
      await supabase.from('comment_reads').upsert(
        { member_id: teamMemberId, comment_id: messageId },
        { onConflict: 'member_id,comment_id' }
      );
    }

    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [teamMemberId]);

  const markAllAsRead = useCallback(async () => {
    if (!teamMemberId) return;
    const unread = messages.filter(m => !m.isRead);
    if (unread.length === 0) return;

    const commentUnread = unread.filter(m => m.type !== 'google_chat');
    const gchatUnread = unread.filter(m => m.type === 'google_chat');

    if (commentUnread.length > 0) {
      const inserts = commentUnread.map(m => ({ member_id: teamMemberId, comment_id: m.id }));
      await supabase.from('comment_reads').upsert(inserts, { onConflict: 'member_id,comment_id' });
    }

    if (gchatUnread.length > 0) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        for (const m of gchatUnread) {
          await (supabase as any)
            .from('google_chat_messages')
            .update({ is_read: true })
            .eq('id', m.id)
            .eq('user_id', user.id);
        }
      }
    }

    setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
    setUnreadCount(0);
  }, [teamMemberId, messages]);

  return { messages, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchMessages };
}
