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

      // Load reactions
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

      // Load profiles
      const userIds = [...new Set(data.map((m: ChatMessage) => m.user_id))];
      loadProfiles(userIds as string[]);
    }
    setLoading(false);
  }, [loadProfiles]);

  useEffect(() => {
    if (activeChannelId) loadMessages(activeChannelId);
  }, [activeChannelId]);

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
        if (!newMsg.thread_id) {
          setMessages(prev => [...prev, newMsg]);
          loadProfiles([newMsg.user_id]);
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_reactions',
      }, () => {
        // Reload reactions for current messages
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

    // Typing indicator channel
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
  }, [activeChannelId, loadProfiles]);

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

  // Mark channel as read
  const markRead = useCallback(async (channelId: string) => {
    if (!user) return;
    await db.from('chat_channel_members').upsert({
      channel_id: channelId,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    }, { onConflict: 'channel_id,user_id' });
  }, [user]);

  // Get unread count for a channel
  const getUnreadCount = useCallback((_channelId: string) => {
    // Simplified - would need channel_members data
    return 0;
  }, []);

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
    markRead,
    getUnreadCount,
    loadChannels,
    user,
  };
}
