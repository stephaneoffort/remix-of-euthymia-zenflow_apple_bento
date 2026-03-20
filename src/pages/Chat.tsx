import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, Send, Paperclip, Smile, X, Plus, Trash2, Settings, ArrowLeft, ChevronDown, MessageCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import { usePresence } from '@/hooks/usePresence';

interface ChatCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

interface ChatMessage {
  id: string;
  category_id: string;
  author_id: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

interface DirectMessage {
  id: string;
  conversation_id: string;
  author_id: string;
  content: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

interface DirectConversation {
  id: string;
  created_at: string;
  updated_at: string;
}

interface ChatReaction {
  id: string;
  message_id: string;
  member_id: string;
  emoji: string;
}

interface TeamMember {
  id: string;
  name: string;
  avatar_color: string;
  avatar_url: string | null;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '🎉', '🤔', '👀', '🔥', '✅'];

type ChatMode = 'channel' | 'dm';

export default function Chat() {
  const { teamMemberId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { unreadCounts, dmUnreadCounts, markCategoryRead, markConversationRead } = useChatNotifications();
  const { isOnline } = usePresence();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<ChatMode>('channel');
  const [messageText, setMessageText] = useState('');
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const isMobile = useIsMobile();

  // Check admin
  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').then(({ data }) => {
      setIsAdmin(!!data?.length);
    });
  }, [user]);

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['chat_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('chat_categories').select('*').order('sort_order');
      if (error) throw error;
      return data as ChatCategory[];
    },
  });

  // Auto-select first category
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory && chatMode === 'channel') {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory, chatMode]);

  // Mark category as read when selected
  useEffect(() => {
    if (selectedCategory && teamMemberId && chatMode === 'channel') {
      markCategoryRead(selectedCategory);
    }
  }, [selectedCategory, teamMemberId, markCategoryRead, chatMode]);

  // Fetch messages for selected category
  const { data: messages = [] } = useQuery({
    queryKey: ['chat_messages', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('category_id', selectedCategory)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ChatMessage[];
    },
    enabled: !!selectedCategory && chatMode === 'channel',
  });

  // Fetch reactions
  const { data: reactions = [] } = useQuery({
    queryKey: ['chat_reactions', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory || messages.length === 0) return [];
      const msgIds = messages.map(m => m.id);
      const { data, error } = await supabase
        .from('chat_reactions')
        .select('*')
        .in('message_id', msgIds);
      if (error) throw error;
      return data as ChatReaction[];
    },
    enabled: !!selectedCategory && messages.length > 0 && chatMode === 'channel',
  });

  // Fetch team members
  const { data: members = [] } = useQuery({
    queryKey: ['chat_team_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('id, name, avatar_color, avatar_url');
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // ─── DM queries ───

  // Fetch conversations with members
  const { data: conversations = [] } = useQuery({
    queryKey: ['direct_conversations', teamMemberId],
    queryFn: async () => {
      if (!teamMemberId) return [];
      // Get conversation IDs where current member is a participant
      const { data: myConvos, error: e1 } = await supabase
        .from('direct_conversation_members')
        .select('conversation_id')
        .eq('member_id', teamMemberId);
      if (e1) throw e1;
      if (!myConvos || myConvos.length === 0) return [];

      const convoIds = myConvos.map(c => c.conversation_id);
      // Fetch conversations
      const { data: convos, error: e2 } = await supabase
        .from('direct_conversations')
        .select('*')
        .in('id', convoIds)
        .order('updated_at', { ascending: false });
      if (e2) throw e2;
      return (convos || []) as DirectConversation[];
    },
    enabled: !!teamMemberId,
  });

  // Fetch all conversation members
  const { data: allConvoMembers = [] } = useQuery({
    queryKey: ['direct_conversation_members', conversations.map(c => c.id).join(',')],
    queryFn: async () => {
      if (conversations.length === 0) return [];
      const convoIds = conversations.map(c => c.id);
      const { data, error } = await supabase
        .from('direct_conversation_members')
        .select('*')
        .in('conversation_id', convoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: conversations.length > 0,
  });

  // Fetch DM messages for selected conversation
  const { data: dmMessages = [] } = useQuery({
    queryKey: ['direct_messages', selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .eq('conversation_id', selectedConversation)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as DirectMessage[];
    },
    enabled: !!selectedConversation && chatMode === 'dm',
  });

  // Get other members in a conversation
  const getConvoOtherMembers = (convoId: string) => {
    return allConvoMembers
      .filter(cm => cm.conversation_id === convoId && cm.member_id !== teamMemberId)
      .map(cm => members.find(m => m.id === cm.member_id))
      .filter(Boolean) as TeamMember[];
  };

  // Find existing conversation with specific members
  const findExistingConversation = (memberIds: string[]) => {
    const targetSet = new Set([...memberIds, teamMemberId!]);
    return conversations.find(convo => {
      const convoMemberIds = allConvoMembers
        .filter(cm => cm.conversation_id === convo.id)
        .map(cm => cm.member_id);
      if (convoMemberIds.length !== targetSet.size) return false;
      return convoMemberIds.every(id => targetSet.has(id));
    });
  };

  // Start or open a DM conversation
  const startDM = async (memberId: string) => {
    if (!teamMemberId) return;
    // Check if conversation already exists
    const existing = findExistingConversation([memberId]);
    if (existing) {
      setChatMode('dm');
      setSelectedConversation(existing.id);
      if (isMobile) setShowCategories(false);
      return;
    }
    // Create new conversation
    const { data: newConvo, error: e1 } = await supabase
      .from('direct_conversations')
      .insert({})
      .select()
      .single();
    if (e1 || !newConvo) { toast.error('Erreur création conversation'); return; }
    // Add members
    const { error: e2 } = await supabase.from('direct_conversation_members').insert([
      { conversation_id: newConvo.id, member_id: teamMemberId },
      { conversation_id: newConvo.id, member_id: memberId },
    ]);
    if (e2) { toast.error('Erreur ajout membres'); return; }
    await queryClient.invalidateQueries({ queryKey: ['direct_conversations'] });
    await queryClient.invalidateQueries({ queryKey: ['direct_conversation_members'] });
    setChatMode('dm');
    setSelectedConversation(newConvo.id);
    if (isMobile) setShowCategories(false);
  };

  // Realtime subscriptions
  useEffect(() => {
    if (chatMode === 'channel' && selectedCategory) {
      const channel = supabase
        .channel(`chat-${selectedCategory}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `category_id=eq.${selectedCategory}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedCategory] });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, () => {
          queryClient.invalidateQueries({ queryKey: ['chat_reactions', selectedCategory] });
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
    if (chatMode === 'dm' && selectedConversation) {
      const channel = supabase
        .channel(`dm-${selectedConversation}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${selectedConversation}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['direct_messages', selectedConversation] });
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [chatMode, selectedCategory, selectedConversation, queryClient]);

  // Scroll to bottom on new messages
  const activeMessages = chatMode === 'channel' ? messages : dmMessages;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  // Send message (channel)
  const sendMutation = useMutation({
    mutationFn: async ({ content, attachmentUrl, attachmentName }: { content: string; attachmentUrl?: string; attachmentName?: string }) => {
      if (!teamMemberId) throw new Error('Missing context');
      if (chatMode === 'channel') {
        if (!selectedCategory) throw new Error('No category');
        const { error } = await supabase.from('chat_messages').insert({
          category_id: selectedCategory,
          author_id: teamMemberId,
          content,
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
        });
        if (error) throw error;
      } else {
        if (!selectedConversation) throw new Error('No conversation');
        const { error } = await supabase.from('direct_messages').insert({
          conversation_id: selectedConversation,
          author_id: teamMemberId,
          content,
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
        });
        if (error) throw error;
        // Update conversation timestamp
        await supabase.from('direct_conversations').update({ updated_at: new Date().toISOString() }).eq('id', selectedConversation);
      }
    },
    onSuccess: () => {
      if (chatMode === 'channel') {
        queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedCategory] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['direct_messages', selectedConversation] });
      }
    },
  });

  // Toggle reaction
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!teamMemberId) return;
    const existing = reactions.find(r => r.message_id === messageId && r.member_id === teamMemberId && r.emoji === emoji);
    if (existing) {
      await supabase.from('chat_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('chat_reactions').insert({ message_id: messageId, member_id: teamMemberId, emoji });
    }
    queryClient.invalidateQueries({ queryKey: ['chat_reactions', selectedCategory] });
    setShowEmojiFor(null);
  }, [teamMemberId, reactions, selectedCategory, queryClient]);

  // File upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file);
    if (error) { toast.error('Erreur upload'); return; }
    const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(path);
    sendMutation.mutate({ content: messageText || `📎 ${file.name}`, attachmentUrl: urlData.publicUrl, attachmentName: file.name });
    setMessageText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = () => {
    if (!messageText.trim()) return;
    sendMutation.mutate({ content: messageText.trim() });
    setMessageText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Mention handling
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessageText(val);
    const pos = e.target.selectionStart || 0;
    setCursorPos(pos);
    const textBeforeCursor = val.slice(0, pos);
    const match = textBeforeCursor.match(/@(\w*)$/);
    setMentionSearch(match ? match[1] : null);
  };

  const insertMention = (memberName: string) => {
    const textBefore = messageText.slice(0, cursorPos);
    const textAfter = messageText.slice(cursorPos);
    const beforeMention = textBefore.replace(/@\w*$/, '');
    setMessageText(`${beforeMention}@${memberName} ${textAfter}`);
    setMentionSearch(null);
    inputRef.current?.focus();
  };

  const filteredMentions = mentionSearch !== null
    ? members.filter(m => m.name.toLowerCase().includes(mentionSearch.toLowerCase())).slice(0, 5)
    : [];

  const getMember = (id: string) => members.find(m => m.id === id);

  const formatContent = (content: string) => {
    return content.replace(/@(\w+(?:\s\w+)*)/g, '<span class="text-primary font-semibold">@$1</span>');
  };

  const groupedReactions = (messageId: string) => {
    const msgReactions = reactions.filter(r => r.message_id === messageId);
    const groups: Record<string, { count: number; members: string[]; hasMe: boolean }> = {};
    msgReactions.forEach(r => {
      if (!groups[r.emoji]) groups[r.emoji] = { count: 0, members: [], hasMe: false };
      groups[r.emoji].count++;
      groups[r.emoji].members.push(r.member_id);
      if (r.member_id === teamMemberId) groups[r.emoji].hasMe = true;
    });
    return groups;
  };

  const currentCategory = categories.find(c => c.id === selectedCategory);
  const otherMembers = members.filter(m => m.id !== teamMemberId);

  // Get conversation display name
  const getConvoName = (convoId: string) => {
    const others = getConvoOtherMembers(convoId);
    if (others.length === 0) return 'Conversation';
    return others.map(m => m.name.split(' ')[0]).join(', ');
  };

  const handleSelectCategory = (id: string) => {
    setChatMode('channel');
    setSelectedCategory(id);
    setSelectedConversation(null);
    if (isMobile) setShowCategories(false);
  };

  const handleSelectConversation = (id: string) => {
    setChatMode('dm');
    setSelectedConversation(id);
    setSelectedCategory(null);
    markConversationRead(id);
    if (isMobile) setShowCategories(false);
  };

  // Current header info
  const headerTitle = chatMode === 'channel'
    ? currentCategory?.name || ''
    : selectedConversation ? getConvoName(selectedConversation) : '';
  const headerIcon = chatMode === 'channel'
    ? currentCategory?.icon || '💬'
    : '✉️';

  // Messages to render
  const displayMessages = chatMode === 'channel' ? messages : dmMessages;

  // Avatar component with presence indicator
  const MemberAvatar = ({ member, size = 'md', showPresence = false }: { member: TeamMember | undefined; size?: 'sm' | 'md'; showPresence?: boolean }) => {
    const s = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
    const dotSize = size === 'sm' ? 'w-2 h-2 border' : 'w-2.5 h-2.5 border-2';
    const online = member ? isOnline(member.id) : false;
    const avatar = member?.avatar_url ? (
      <img src={member.avatar_url} alt={member.name} className={`${s} rounded-full object-cover shrink-0`} />
    ) : (
      <div
        className={`${s} rounded-full flex items-center justify-center font-bold text-primary-foreground shrink-0`}
        style={{ backgroundColor: member?.avatar_color || 'hsl(var(--muted))' }}
      >
        {member?.name?.charAt(0).toUpperCase() || '?'}
      </div>
    );

    if (showPresence && online) {
      return (
        <div className="relative shrink-0">
          {avatar}
          <span className={`absolute bottom-0 right-0 ${dotSize} bg-green-500 border-card rounded-full`} />
        </div>
      );
    }
    return avatar;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - categories + DMs */}
      {(!isMobile || showCategories) && (
        <div className={`${isMobile ? 'absolute inset-0 z-30' : 'w-60'} bg-card border-r border-border flex flex-col shrink-0`}>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-foreground">💬 Chat</h2>
            {!isMobile && (
              <button onClick={() => navigate('/')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                ← Retour
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Channels section */}
            <div className="p-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3 h-3" />
                Canaux
              </p>
              <div className="space-y-0.5">
                {categories.map(cat => {
                  const unread = unreadCounts[cat.id] || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors ${
                        chatMode === 'channel' && selectedCategory === cat.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span className="flex-1 text-left">{cat.name}</span>
                      {unread > 0 && (
                        <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Messages section */}
            <div className="p-2 border-t border-border">
              <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageCircle className="w-3 h-3" />
                Messages directs
              </p>

              {/* Existing conversations */}
              <div className="space-y-0.5">
                {conversations.map(convo => {
                  const others = getConvoOtherMembers(convo.id);
                  const dmUnread = dmUnreadCounts[convo.id] || 0;
                  return (
                    <button
                      key={convo.id}
                      onClick={() => handleSelectConversation(convo.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-md text-sm transition-colors ${
                        chatMode === 'dm' && selectedConversation === convo.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : dmUnread > 0
                            ? 'text-foreground font-medium hover:bg-muted'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {others.length === 1 ? (
                        <MemberAvatar member={others[0]} size="sm" showPresence />
                      ) : (
                        <Users className="w-4 h-4 shrink-0" />
                      )}
                      <span className="flex-1 text-left truncate">{getConvoName(convo.id)}</span>
                      {dmUnread > 0 && (
                        <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium">
                          {dmUnread > 99 ? '99+' : dmUnread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Member list for new DM */}
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="px-3 py-1 text-[10px] text-muted-foreground">Nouveau message</p>
                <div className="space-y-0.5">
                  {otherMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => startDM(m.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <MemberAvatar member={m} size="sm" showPresence />
                      <span className="flex-1 text-left truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => navigate('/settings')}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Gérer les catégories
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main chat area */}
      {(!isMobile || !showCategories) && (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-12 sm:h-14 border-b border-border bg-card flex items-center px-3 sm:px-6 gap-3 shrink-0">
            {isMobile && (
              <button onClick={() => setShowCategories(true)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <span className="text-lg">{headerIcon}</span>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">{headerTitle}</h3>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 scrollbar-thin">
            {displayMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {chatMode === 'channel' ? 'Aucun message. Soyez le premier à écrire ! 🎉' : 'Commencez la conversation ! ✉️'}
              </div>
            )}
            {displayMessages.map((msg, i) => {
              const author = getMember(msg.author_id);
              const prevMsg = displayMessages[i - 1];
              const showAuthor = !prevMsg || prevMsg.author_id !== msg.author_id ||
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;
              const rGroups = chatMode === 'channel' ? groupedReactions(msg.id) : {};

              return (
                <div key={msg.id} className={`group ${showAuthor ? 'mt-4' : 'mt-0.5'}`}>
                  {showAuthor && (
                    <div className="flex items-center gap-2 mb-1">
                      <MemberAvatar member={author} />
                      <span className="font-semibold text-sm text-foreground">{author?.name || 'Inconnu'}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  <div className={`${showAuthor ? 'ml-10' : 'ml-10'} relative`}>
                    <div
                      className="text-sm text-foreground leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                    />
                    {msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-muted text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Paperclip className="w-3 h-3" />
                        {msg.attachment_name || 'Fichier'}
                      </a>
                    )}

                    {/* Reactions display (channel only) */}
                    {chatMode === 'channel' && Object.keys(rGroups).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(rGroups).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                              data.hasMe
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-muted border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            {emoji} {data.count}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Hover actions (channel only) */}
                    {chatMode === 'channel' && (
                      <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-md shadow-sm px-1 py-0.5">
                        <button
                          onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Emoji picker */}
                    {showEmojiFor === msg.id && (
                      <div className="absolute -top-10 right-0 bg-card border border-border rounded-lg shadow-lg p-1.5 flex gap-1 z-10">
                        {EMOJI_LIST.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors text-sm"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className={`border-t border-border bg-card p-3 sm:p-4 ${isMobile ? 'pb-16' : ''}`}>
            <div className="relative">
              {/* Mention dropdown */}
              {filteredMentions.length > 0 && (
                <div className="absolute bottom-full mb-1 left-0 bg-card border border-border rounded-lg shadow-lg p-1 w-56 z-20">
                  {filteredMentions.map(m => (
                    <button
                      key={m.id}
                      onClick={() => insertMention(m.name)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                    >
                      <MemberAvatar member={m} size="sm" />
                      <span className="text-foreground">{m.name}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={messageText}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={chatMode === 'channel' ? `Message dans #${currentCategory?.name || ''}...` : `Message à ${headerTitle}...`}
                    className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[42px] max-h-32"
                    rows={1}
                  />
                </div>
                <input
                  ref={fileInputRef}
                  id="chat-file-upload"
                  type="file"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <label
                  htmlFor="chat-file-upload"
                  className="p-2.5 rounded-lg border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Joindre un fichier"
                >
                  <Paperclip className="w-4 h-4" />
                </label>
                <button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending}
                  className="p-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
}
