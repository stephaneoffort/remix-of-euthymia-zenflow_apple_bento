import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hash, Send, Paperclip, Smile, X, Plus, Trash2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useChatNotifications } from '@/hooks/useChatNotifications';

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

export default function Chat() {
  const { teamMemberId, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { unreadCounts, markCategoryRead } = useChatNotifications();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

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
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0].id);
    }
  }, [categories, selectedCategory]);

  // Mark category as read when selected and messages load
  useEffect(() => {
    if (selectedCategory && teamMemberId) {
      markCategoryRead(selectedCategory);
    }
  }, [selectedCategory, messages, teamMemberId, markCategoryRead]);

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
    enabled: !!selectedCategory,
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
    enabled: !!selectedCategory && messages.length > 0,
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

  // Realtime subscriptions
  useEffect(() => {
    if (!selectedCategory) return;

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
  }, [selectedCategory, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async ({ content, attachmentUrl, attachmentName }: { content: string; attachmentUrl?: string; attachmentName?: string }) => {
      if (!teamMemberId || !selectedCategory) throw new Error('Missing context');
      const { error } = await supabase.from('chat_messages').insert({
        category_id: selectedCategory,
        author_id: teamMemberId,
        content,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat_messages', selectedCategory] });
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

  return (
    <div className="flex h-screen bg-background">
      {/* Category sidebar */}
      <div className="w-60 bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">💬 Chat</h2>
          <button onClick={() => navigate('/')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Retour
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {categories.map(cat => {
            const unread = unreadCounts[cat.id] || 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  selectedCategory === cat.id
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card flex items-center px-6 gap-3 shrink-0">
          {currentCategory && (
            <>
              <span className="text-lg">{currentCategory.icon}</span>
              <h3 className="font-semibold text-foreground">{currentCategory.name}</h3>
            </>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Aucun message. Soyez le premier à écrire ! 🎉
            </div>
          )}
          {messages.map((msg, i) => {
            const author = getMember(msg.author_id);
            const isMe = msg.author_id === teamMemberId;
            const prevMsg = messages[i - 1];
            const showAuthor = !prevMsg || prevMsg.author_id !== msg.author_id ||
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;
            const rGroups = groupedReactions(msg.id);

            return (
              <div key={msg.id} className={`group ${showAuthor ? 'mt-4' : 'mt-0.5'}`}>
                {showAuthor && (
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0"
                      style={{ backgroundColor: author?.avatar_color || 'hsl(var(--muted))' }}
                    >
                      {author?.name?.charAt(0).toUpperCase() || '?'}
                    </div>
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

                  {/* Reactions display */}
                  {Object.keys(rGroups).length > 0 && (
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

                  {/* Hover actions */}
                  <div className="absolute -top-3 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card border border-border rounded-md shadow-sm px-1 py-0.5">
                    <button
                      onClick={() => setShowEmojiFor(showEmojiFor === msg.id ? null : msg.id)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                  </div>

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
        <div className="border-t border-border bg-card p-4">
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
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0"
                      style={{ backgroundColor: m.avatar_color }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
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
                  placeholder={`Message dans #${currentCategory?.name || ''}...`}
                  className="w-full resize-none rounded-lg border border-input bg-background px-4 py-2.5 pr-10 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[42px] max-h-32"
                  rows={1}
                />
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-lg border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Joindre un fichier"
              >
                <Paperclip className="w-4 h-4" />
              </button>
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
    </div>
  );
}
