import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import { useSystemNotifications } from './useSystemNotifications';

const db = supabase as any;

/**
 * Central hook that listens to Supabase realtime events and fires OS-level
 * notifications for: chat messages, comment mentions, new emails, task assignments.
 *
 * Mount once via <GlobalNotifications /> inside BrowserRouter in App.tsx.
 * Notifications only appear when Notification.permission === 'granted'.
 */
export function useRealtimeNotifications() {
  const { user, teamMemberId } = useAuth();
  const { notify } = useSystemNotifications();
  const location = useLocation();

  // Keep a ref so subscriptions don't need to be re-created on route change
  const pathRef = useRef(location.pathname);
  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  // ── Chat messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('rt-os-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.user_id === user.id) return;
        if (msg.is_deleted) return;
        if (pathRef.current === '/chat') return;

        notify('💬 Nouveau message', {
          body: (msg.content || 'Nouveau message').replace(/\n/g, ' ').slice(0, 120),
          url: '/chat',
          tag: `chat-${msg.channel_id}`,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, notify]);

  // ── Commentaires avec mention ──────────────────────────────────────────────
  useEffect(() => {
    if (!teamMemberId) return;

    const channel = supabase
      .channel('rt-os-comments')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
      }, (payload) => {
        const comment = payload.new as any;
        const mentioned: string[] = Array.isArray(comment.mentioned_member_ids)
          ? comment.mentioned_member_ids
          : [];
        if (!mentioned.includes(teamMemberId)) return;

        const body = (comment.content || '')
          .replace(/@[\w.-]+/g, '')
          .trim()
          .slice(0, 120) || 'Vous avez été mentionné';

        notify('💬 Mention dans un commentaire', {
          body,
          url: '/',
          tag: `comment-${comment.id}`,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, notify]);

  // ── Nouveaux emails ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('rt-os-emails')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'email_messages',
      }, (payload) => {
        const email = payload.new as any;
        if (pathRef.current === '/email') return;

        const from = email.from_name
          ? `${email.from_name} <${email.from_address}>`
          : (email.from_address || '');
        const subject = email.subject || '(sans sujet)';

        notify('📧 Nouvel email', {
          body: [from, subject].filter(Boolean).join('\n').slice(0, 120),
          url: '/email',
          tag: `email-${email.id}`,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, notify]);

  // ── Tâche assignée à l'utilisateur ─────────────────────────────────────────
  useEffect(() => {
    if (!teamMemberId) return;

    const channel = supabase
      .channel('rt-os-task-assign')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_assignees',
      }, (payload) => {
        const row = payload.new as any;
        if (row.team_member_id !== teamMemberId) return;

        notify('✅ Nouvelle tâche assignée', {
          body: 'Une tâche vient de vous être assignée.',
          url: '/',
          tag: `task-assign-${row.task_id}`,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, notify]);

  // ── Sous-tâche assignée à l'utilisateur ────────────────────────────────────
  useEffect(() => {
    if (!teamMemberId) return;

    // Listen for tasks inserted with a parent_id (= sous-tâches)
    // and assigned to the current user via the task_assignees channel above.
    // Additionally, we can listen to subtask INSERT on the tasks table directly
    // if the DB uses a parent_id column.
    const channel = supabase
      .channel('rt-os-subtasks')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tasks',
      }, (payload) => {
        const task = payload.new as any;
        // Only care about subtasks (tasks with a parent)
        if (!task.parent_id) return;
        // We can't filter by assignee here without a join;
        // show a notification only if the task was explicitly created
        // (avoid spamming — suppress if we're already on the main page)
        if (pathRef.current === '/') return;

        notify('📋 Nouvelle sous-tâche', {
          body: (task.title || 'Nouvelle sous-tâche').slice(0, 120),
          url: '/',
          tag: `subtask-${task.id}`,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [teamMemberId, notify]);
}
