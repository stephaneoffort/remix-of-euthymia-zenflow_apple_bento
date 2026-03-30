import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { ChatChannel, ChatMessage, ChatReaction, MemberProfile } from '@/types/chat';

const db = supabase as any;

export function useDiscordChat() {
  const { user } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, ChatReaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([]);
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searching, setSearching] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesRef = useRef<ChatMessage[]>([]);
  const typingTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  messagesRef.current = messages;

  // Load channels
  const loadChannels = useCallback(async () => {
    const { data } = await db
      .from('chat_channels')
      .select('*')
      .eq('is_archived', false)
      .order('position');

    if (data) {
      setChannels(data);
      if (!activeChannelId && data.length > 0) {
        setActiveChannelId(data[0].id);
      }
    }
  }, [activeChannelId]);

  useEffect(() => { loadChannels(); }, []);

  // Load member profiles
  const loadProfiles = useCallback(async (userIds: string[]) => {
    const newIds = userIds.filter(id => !memberProfiles[id]);
    if (newIds.length === 0) return;

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, team_member_id')
      .in('id', newIds);

    if (!profiles?.length) return;

    const teamMemberIds = profiles.map(p => p.team_member_id).filter(Boolean) as string[];
    if (teamMemberIds.length === 0) return;

    const { data: members } = await supabase
      .from('team_members')
      .select('*')
      .in('id', teamMemberIds);

    if (members) {
      const profileMap: Record<string, MemberProfile> = {};
      profiles.forEach(p => {
        const member = members.find(m => m.id === p.team_member_id);
        if (member) profileMap[p.id] = member as MemberProfile;
      });
      setMemberProfiles(prev => ({ ...prev, ...profileMap }));
    }
  }, [memberProfiles]);

  // Load messages for active channel
  const loadMessages = useCallback(async (channelId: string) => {
    setLoading(true);
    const { data } = await db
      .from('chat_messages')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_deleted', false)
      .is('thread_id', null)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setMessages(data);

      const messageIds = data.map((m: ChatMessage) => m.id);
      if (messageIds.length > 0) {
        const { data: rxns } = await db
          .from('chat_reactions')
          .select('*')
          .in('message_id', messageIds);

        if (rxns) {
          const grouped: Record<string, ChatReaction[]> = {};
          rxns.forEach((r: ChatReaction) => {
            if (!grouped[r.message_id]) grouped[r.message_id] = [];
            grouped[r.message_id].push(r);
          });
          setReactions(grouped);
        }
      }

      const userIds = [...new Set(data.map((m: ChatMessage) => m.user_id))];
      loadProfiles(userIds as string[]);
    }
    setLoading(false);
  }, [loadProfiles]);

  useEffect(() => {
    if (activeChannelId) {
      loadMessages(activeChannelId);
      loadPinnedMessages(activeChannelId);
    }
    setThreadParent(null);
    setThreadMessages([]);
  }, [activeChannelId]);

  // Load pinned messages
  const loadPinnedMessages = useCallback(async (channelId: string) => {
    const { data: pins } = await db
      .from('chat_pinned_messages')
      .select('message_id')
      .eq('channel_id', channelId);

    if (pins && pins.length > 0) {
      const msgIds = pins.map((p: any) => p.message_id);
      const { data: msgs } = await db
        .from('chat_messages')
        .select('*')
        .in('id', msgIds)
        .eq('is_deleted', false);
      setPinnedMessages(msgs || []);
    } else {
      setPinnedMessages([]);
    }
  }, []);

  // Pin/unpin a message
  const togglePin = useCallback(async (messageId: string) => {
    if (!activeChannelId || !user) return;
    const isPinned = pinnedMessages.some(m => m.id === messageId);
    if (isPinned) {
      await db.from('chat_pinned_messages').delete()
        .eq('message_id', messageId)
        .eq('channel_id', activeChannelId);
    } else {
      await db.from('chat_pinned_messages').insert({
        message_id: messageId,
        channel_id: activeChannelId,
        pinned_by: user.id,
      });
    }
    await loadPinnedMessages(activeChannelId);
  }, [activeChannelId, user, pinnedMessages, loadPinnedMessages]);

  // Open thread
  const openThread = useCallback(async (parentMsg: ChatMessage) => {
    setThreadParent(parentMsg);
    const { data } = await db
      .from('chat_messages')
      .select('*')
      .eq('thread_id', parentMsg.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
    const userIds = [...new Set((data || []).map((m: ChatMessage) => m.user_id))];
    if (userIds.length) loadProfiles(userIds as string[]);
  }, [loadProfiles]);

  const closeThread = useCallback(() => {
    setThreadParent(null);
    setThreadMessages([]);
  }, []);

  // Send thread reply
  const sendThreadReply = useCallback(async (content: string) => {
    if (!threadParent || !activeChannelId || !user) return;
    await db.from('chat_messages').insert({
      channel_id: activeChannelId,
      user_id: user.id,
      content,
      thread_id: threadParent.id,
    });
    // reload thread
    const { data } = await db
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadParent.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });
    setThreadMessages(data || []);
  }, [threadParent, activeChannelId, user]);

  // Search messages
  const searchMessages = useCallback(async (query: string) => {
    if (!activeChannelId || !query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const { data } = await db
      .from('chat_messages')
      .select('*')
      .eq('channel_id', activeChannelId)
      .eq('is_deleted', false)
      .ilike('content', `%${query.trim()}%`)
      .order('created_at', { ascending: false })
      .limit(20);
    setSearchResults(data || []);
    if (data) {
      const userIds = [...new Set(data.map((m: ChatMessage) => m.user_id))];
      loadProfiles(userIds as string[]);
    }
    setSearching(false);
  }, [activeChannelId, loadProfiles]);

  // Realtime subscriptions
  useEffect(() => {
    if (!activeChannelId) return;

    const channel = supabase
      .channel(`chat-${activeChannelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `channel_id=eq.${activeChannelId}`,
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.thread_id === threadParent?.id) {
          setThreadMessages(prev => [...prev, newMsg]);
        } else if (!newMsg.thread_id) {
          setMessages(prev => [...prev, newMsg]);
        }
        loadProfiles([newMsg.user_id]);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_reactions',
      }, () => {
        const ids = messagesRef.current.map(m => m.id);
        if (ids.length > 0) {
          db.from('chat_reactions').select('*').in('message_id', ids).then(({ data: rxns }: any) => {
            if (rxns) {
              const grouped: Record<string, ChatReaction[]> = {};
              rxns.forEach((r: ChatReaction) => {
                if (!grouped[r.message_id]) grouped[r.message_id] = [];
                grouped[r.message_id].push(r);
              });
              setReactions(grouped);
            }
          });
        }
      })
      .subscribe();

    const typingChannel = supabase
      .channel(`typing-${activeChannelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const name = payload?.user_name;
        if (!name) return;
        setTypingUsers(prev => prev.includes(name) ? prev : [...prev, name]);
        if (typingTimeouts.current[name]) clearTimeout(typingTimeouts.current[name]);
        typingTimeouts.current[name] = setTimeout(() => {
          setTypingUsers(prev => prev.filter(n => n !== name));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingChannel);
      setTypingUsers([]);
    };
  }, [activeChannelId, loadProfiles, threadParent]);

  // Send message
  const sendMessage = useCallback(async (content: string, mentionedUsers?: string[]) => {
    if (!activeChannelId || !user) return;
    await db.from('chat_messages').insert({
      channel_id: activeChannelId,
      user_id: user.id,
      content,
      mentioned_users: mentionedUsers || [],
    });
  }, [activeChannelId, user]);

  // Toggle reaction
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions[messageId]?.find(
      r => r.user_id === user.id && r.emoji === emoji
    );
    if (existing) {
      await db.from('chat_reactions').delete().eq('id', existing.id);
    } else {
      await db.from('chat_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    }
  }, [user, reactions]);

  // Broadcast typing
  const sendTyping = useCallback(async () => {
    if (!activeChannelId || !user) return;
    const profile = memberProfiles[user.id];
    const typingCh = supabase.channel(`typing-${activeChannelId}`);
    await typingCh.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_name: profile?.name || 'Quelqu\'un' },
    });
  }, [activeChannelId, user, memberProfiles]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return;
    await db.from('chat_messages').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', messageId).eq('user_id', user.id);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, [user]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!user) return;
    await db.from('chat_messages').update({ content: newContent, is_edited: true, updated_at: new Date().toISOString() }).eq('id', messageId).eq('user_id', user.id);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent, is_edited: true } : m));
  }, [user]);

  return {
    channels,
    activeChannelId,
    setActiveChannelId,
    messages,
    reactions,
    loading,
    memberProfiles,
    typingUsers,
    sendMessage,
    toggleReaction,
    sendTyping,
    loadChannels,
    user,
    // New features
    pinnedMessages,
    togglePin,
    openThread,
    closeThread,
    threadParent,
    threadMessages,
    sendThreadReply,
    searchMessages,
    searchQuery,
    setSearchQuery,
    searchResults,
    searching,
    deleteMessage,
    editMessage,
  };
}
