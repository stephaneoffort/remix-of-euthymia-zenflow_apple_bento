import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, ChatReaction, MemberProfile } from '@/types/chat';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, Pin, MoreHorizontal, Smile, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const renderContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium text-[13px]">@{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2.5">
          {[0, 150, 300].map(delay => (
            <motion.div
              key={delay}
              className="w-2.5 h-2.5 rounded-full bg-primary/60"
              animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1, delay: delay / 1000 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="w-24 h-24 rounded-3xl bg-primary/8 backdrop-blur-xl border border-primary/15 flex items-center justify-center shadow-[0_8px_32px_hsl(var(--primary)/0.1)]"
        >
          <MessageCircle className="w-12 h-12 text-primary/50" />
        </motion.div>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <p className="text-lg font-semibold text-foreground mb-1.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
            Bienvenue dans ce canal !
          </p>
          <p className="text-sm text-muted-foreground/80 max-w-sm leading-relaxed">
            C'est le début de la conversation. Envoie un message pour commencer à échanger avec ton équipe.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="px-4 py-4">
        {messages.map((msg, idx) => {
          const profile = memberProfiles[msg.user_id];
          const showHeader = shouldShowHeader(msg, idx);
          const showDate = shouldShowDateSep(msg, idx);
          const msgReactions = reactions[msg.id] || [];
          const isHovered = hoveredMessageId === msg.id;
          const isOwn = msg.user_id === currentUserId;

          const reactionGroups: Record<string, { count: number; userIds: string[] }> = {};
          msgReactions.forEach(r => {
            if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, userIds: [] };
            reactionGroups[r.emoji].count++;
            reactionGroups[r.emoji].userIds.push(r.user_id);
          });

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                  <span className="text-[11px] font-semibold text-muted-foreground/80 backdrop-blur-xl bg-card/40 px-4 py-1.5 rounded-full border border-border/30 shadow-sm">
                    {formatMessageDate(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                </div>
              )}

              <div
                className={`group relative rounded-2xl px-3 -mx-1 transition-all duration-200 ${
                  isHovered ? 'bg-muted/30 backdrop-blur-sm' : 'hover:bg-muted/15'
                } ${showHeader ? 'mt-4 pt-2' : 'py-0.5'}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Glass hover action bar */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute -top-3 right-2 flex items-center gap-0.5 backdrop-blur-xl bg-card/70 border border-border/30 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] p-0.5 z-20"
                    >
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-muted/50 transition-all" title="Réagir">
                            <Smile className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 backdrop-blur-xl bg-card/80 border-border/30" align="end">
                          <div className="flex gap-1 flex-wrap max-w-[200px]">
                            {QUICK_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => onToggleReaction(msg.id, emoji)}
                                className="p-1.5 rounded-lg hover:bg-muted/50 text-lg transition-transform hover:scale-125 active:scale-95"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {[
                        { icon: MessageSquare, title: 'Répondre' },
                        { icon: Pin, title: 'Épingler' },
                        { icon: MoreHorizontal, title: 'Plus' },
                      ].map(({ icon: Icon, title }) => (
                        <button key={title} className="p-1.5 rounded-lg hover:bg-muted/50 transition-all" title={title}>
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-3">
                  {showHeader ? (
                    <div className="relative mt-0.5">
                      <div
                        className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center text-sm font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
                        style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}
                      >
                        {(profile?.name || '?')[0].toUpperCase()}
                      </div>
                      {/* Subtle glow under avatar */}
                      <div
                        className="absolute inset-0 rounded-2xl blur-md opacity-30 -z-10"
                        style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 shrink-0 flex items-center justify-center">
                      <span className="text-[10px] text-transparent group-hover:text-muted-foreground/40 transition-colors tabular-nums">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {showHeader && (
                      <div className="flex items-baseline gap-2 mb-1">
                        <span
                          className="font-semibold text-sm text-foreground hover:underline cursor-pointer"
                          style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
                        >
                          {profile?.name || 'Utilisateur'}
                        </span>
                        <span className="text-[11px] text-muted-foreground/50">
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg.is_edited && (
                          <span className="text-[10px] text-muted-foreground/40 italic">(modifié)</span>
                        )}
                      </div>
                    )}
                    <p className="text-[14px] text-foreground/90 whitespace-pre-wrap break-words leading-[1.6]">
                      {renderContent(msg.content)}
                    </p>

                    {/* Reactions */}
                    {Object.keys(reactionGroups).length > 0 && (
                      <div className="flex gap-1.5 mt-2.5 flex-wrap">
                        {Object.entries(reactionGroups).map(([emoji, data]) => {
                          const hasReacted = currentUserId ? data.userIds.includes(currentUserId) : false;
                          return (
                            <motion.button
                              key={emoji}
                              whileHover={{ scale: 1.08 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => onToggleReaction(msg.id, emoji)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs border backdrop-blur-sm transition-all duration-200 ${
                                hasReacted
                                  ? 'bg-primary/12 border-primary/25 text-primary font-medium shadow-[0_0_8px_hsl(var(--primary)/0.1)]'
                                  : 'bg-card/30 border-border/30 hover:bg-muted/40 text-foreground'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="font-semibold tabular-nums">{data.count}</span>
                            </motion.button>
                          );
                        })}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="inline-flex items-center px-2 py-1 rounded-xl text-xs border border-dashed border-border/30 hover:bg-muted/30 text-muted-foreground/60 backdrop-blur-sm transition-all">
                              <Smile className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-2 backdrop-blur-xl bg-card/80 border-border/30" align="start">
                            <div className="flex gap-1 flex-wrap max-w-[200px]">
                              {QUICK_EMOJIS.map(e => (
                                <button
                                  key={e}
                                  onClick={() => onToggleReaction(msg.id, e)}
                                  className="p-1.5 rounded-lg hover:bg-muted/50 text-lg transition-transform hover:scale-125"
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
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground"
            >
              <div className="flex gap-1">
                {[0, 150, 300].map(delay => (
                  <motion.div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-primary/50"
                    animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 0.8, delay: delay / 1000 }}
                  />
                ))}
              </div>
              <span className="text-xs">
                <strong className="text-foreground">{typingUsers.join(', ')}</strong> {typingUsers.length > 1 ? 'écrivent' : 'écrit'}...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
