import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface AppMessage {
  id: string;
  type: 'comment' | 'chat' | 'dm';
  content: string;
  authorId: string;
  authorName: string;
  entityType?: string;
  entityId?: string;
  entityTitle?: string;
  isRead: boolean;
  createdAt: string;
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

    const allMessages: AppMessage[] = (comments ?? []).map(c => ({
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

    allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setMessages(allMessages);
    setUnreadCount(allMessages.filter(m => !m.isRead).length);
    setLoading(false);
  }, [teamMemberId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription for new comments
  useEffect(() => {
    if (!teamMemberId) return;
    const channel = supabase
      .channel('messages-sidebar')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, fetchMessages]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!teamMemberId) return;
    await supabase.from('comment_reads').upsert(
      { member_id: teamMemberId, comment_id: messageId },
      { onConflict: 'member_id,comment_id' }
    );
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isRead: true } : m));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [teamMemberId]);

  const markAllAsRead = useCallback(async () => {
    if (!teamMemberId) return;
    const unread = messages.filter(m => !m.isRead);
    if (unread.length === 0) return;
    const inserts = unread.map(m => ({ member_id: teamMemberId, comment_id: m.id }));
    await supabase.from('comment_reads').upsert(inserts, { onConflict: 'member_id,comment_id' });
    setMessages(prev => prev.map(m => ({ ...m, isRead: true })));
    setUnreadCount(0);
  }, [teamMemberId, messages]);

  return { messages, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchMessages };
}
