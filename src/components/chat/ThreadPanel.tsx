import { useState, useRef, useEffect } from 'react';
import type { ChatMessage, MemberProfile } from '@/types/chat';
import { format } from 'date-fns';
import { X, Send, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  parentMessage: ChatMessage;
  replies: ChatMessage[];
  memberProfiles: Record<string, MemberProfile>;
  onSendReply: (content: string) => void;
  onClose: () => void;
  currentUserId?: string;
}

export function ThreadPanel({ parentMessage, replies, memberProfiles, onSendReply, onClose, currentUserId }: Props) {
  const [content, setContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSendReply(trimmed);
    setContent('');
    inputRef.current?.focus();
  };

  const parentProfile = memberProfiles[parentMessage.user_id];

  return (
    <div className="w-full h-full flex flex-col border-l border-border/20 backdrop-blur-2xl bg-card/15 shadow-[inset_1px_0_0_rgba(255,255,255,0.03)]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/20 shrink-0 bg-card/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Thread</h3>
          <span data-numeric className="font-numeric tabular-nums text-[11px] text-muted-foreground/50">{replies.length} réponse{replies.length !== 1 ? 's' : ''}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-border/15 bg-primary/[0.03]">
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: parentProfile?.avatar_color || '#6366f1' }}>
            {(parentProfile?.name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="font-semibold text-sm text-foreground">{parentProfile?.name || 'Utilisateur'}</span>
              <span className="text-[10px] text-muted-foreground/40">{format(new Date(parentMessage.created_at), 'HH:mm')}</span>
            </div>
            <p className="text-[13px] text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{parentMessage.content}</p>
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {replies.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground/50">
            Aucune réponse pour l'instant
          </div>
        )}
        {replies.map(reply => {
          const profile = memberProfiles[reply.user_id];
          return (
            <motion.div key={reply.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 py-2"
            >
              <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}>
                {(profile?.name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="font-medium text-[13px] text-foreground">{profile?.name || 'Utilisateur'}</span>
                  <span className="text-[10px] text-muted-foreground/40">{format(new Date(reply.created_at), 'HH:mm')}</span>
                </div>
                <p className="text-[13px] text-foreground/85 whitespace-pre-wrap break-words leading-relaxed">{reply.content}</p>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 shrink-0">
        <div className="flex items-end gap-2 backdrop-blur-2xl bg-card/25 border border-border/20 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <textarea
            ref={inputRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Répondre au thread…"
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/35 min-h-[24px] max-h-[80px] leading-relaxed"
            rows={1}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 80) + 'px';
            }}
          />
          {content.trim() && (
            <button onClick={handleSend}
              className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_12px_hsl(var(--primary)/0.25)]">
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
