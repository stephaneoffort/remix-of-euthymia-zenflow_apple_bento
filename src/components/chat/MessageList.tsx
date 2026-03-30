import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatReaction, MemberProfile } from '@/types/chat';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Hash, MessageSquare, Pin, MoreHorizontal, Smile } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🤔', '👀', '🔥', '✅'];

interface Props {
  messages: ChatMessage[];
  reactions: Record<string, ChatReaction[]>;
  memberProfiles: Record<string, MemberProfile>;
  onToggleReaction: (messageId: string, emoji: string) => void;
  loading: boolean;
  currentUserId?: string;
  typingUsers?: string[];
}

export function MessageList({ messages, reactions, memberProfiles, onToggleReaction, loading, currentUserId, typingUsers = [] }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Aujourd'hui";
    if (isYesterday(date)) return 'Hier';
    return format(date, 'EEEE d MMMM yyyy', { locale: fr });
  };

  const shouldShowHeader = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (prev.user_id !== msg.user_id) return true;
    const diff = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
    return diff > 5 * 60 * 1000;
  };

  const shouldShowDateSep = (msg: ChatMessage, idx: number) => {
    if (idx === 0) return true;
    return !isSameDay(new Date(msg.created_at), new Date(messages[idx - 1].created_at));
  };

  // Render formatted content with @mentions highlighted
  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="bg-primary/15 text-primary px-1 rounded font-medium">@{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
          <Hash className="w-8 h-8 opacity-40" />
        </div>
        <p className="text-lg font-semibold text-foreground">Bienvenue dans ce canal !</p>
        <p className="text-sm text-center max-w-md">C'est le début de la conversation. Envoie un message pour commencer.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="px-4 py-2">
        {messages.map((msg, idx) => {
          const profile = memberProfiles[msg.user_id];
          const showHeader = shouldShowHeader(msg, idx);
          const showDate = shouldShowDateSep(msg, idx);
          const msgReactions = reactions[msg.id] || [];
          const isHovered = hoveredMessageId === msg.id;

          // Group reactions
          const reactionGroups: Record<string, { count: number; userIds: string[] }> = {};
          msgReactions.forEach(r => {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, userIds: [] };
            reactionGroups[r.emoji].count++;
            reactionGroups[r.emoji].userIds.push(r.user_id);
          });

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    {formatMessageDate(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
              )}

              <div
                className={`group relative rounded-md px-2 -mx-2 transition-colors ${isHovered ? 'bg-muted/40' : 'hover:bg-muted/30'} ${showHeader ? 'mt-4 pt-1' : 'py-0.5'}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Hover action bar */}
                {isHovered && (
                  <div className="absolute -top-3.5 right-2 flex items-center gap-0.5 bg-card border rounded-md shadow-md p-0.5 z-20">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Réagir">
                          <Smile className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2" align="end">
                        <div className="flex gap-1 flex-wrap max-w-[200px]">
                          {QUICK_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => onToggleReaction(msg.id, emoji)}
                              className="p-1.5 rounded hover:bg-muted text-lg transition-transform hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Répondre">
                      <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Épingler">
                      <Pin className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Plus">
                      <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  {showHeader ? (
                    <div
                      className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white mt-0.5"
                      style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}
                    >
                      {(profile?.name || '?')[0].toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-transparent group-hover:text-muted-foreground/50 transition-colors tabular-nums">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="font-semibold text-sm text-foreground hover:underline cursor-pointer">
                          {profile?.name || 'Utilisateur'}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg.is_edited && (
                          <span className="text-[10px] text-muted-foreground/60">(modifié)</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                      {renderContent(msg.content)}
                    </p>

                    {/* Reactions */}
                    {Object.keys(reactionGroups).length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {Object.entries(reactionGroups).map(([emoji, data]) => {
                          const hasReacted = currentUserId ? data.userIds.includes(currentUserId) : false;
                          return (
                            <button
                              key={emoji}
                              onClick={() => onToggleReaction(msg.id, emoji)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all duration-150 hover:scale-105 ${
                                hasReacted
                                  ? 'bg-primary/10 border-primary/30 text-primary'
                                  : 'bg-muted/40 border-border/50 hover:bg-muted/70 text-foreground'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-semibold tabular-nums">{data.count}</span>
                            </button>
                          );
                        })}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border border-dashed border-border/50 hover:bg-muted/50 text-muted-foreground transition-colors">
                              <Smile className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2" align="start">
                            <div className="flex gap-1 flex-wrap max-w-[200px]">
                              {QUICK_EMOJIS.map(e => (
                                <button
                                  key={e}
                                  onClick={() => onToggleReaction(msg.id, e)}
                                  className="p-1.5 rounded hover:bg-muted text-lg transition-transform hover:scale-125"
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
            <div className="flex gap-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs">
              <strong>{typingUsers.join(', ')}</strong> {typingUsers.length > 1 ? 'écrivent' : 'écrit'}...
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
