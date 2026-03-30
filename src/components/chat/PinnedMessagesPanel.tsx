import type { ChatMessage, MemberProfile } from '@/types/chat';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Pin } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  messages: ChatMessage[];
  memberProfiles: Record<string, MemberProfile>;
  onUnpin: (messageId: string) => void;
  onClose: () => void;
}

export function PinnedMessagesPanel({ messages, memberProfiles, onUnpin, onClose }: Props) {
  return (
    <div className="w-full h-full flex flex-col border-l border-border/20 backdrop-blur-2xl bg-card/15 shadow-[inset_1px_0_0_rgba(255,255,255,0.03)]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/20 shrink-0 bg-card/20">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Messages épinglés</h3>
          <span className="text-[11px] text-muted-foreground/50">{messages.length}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Pinned list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Pin className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/40">Aucun message épinglé</p>
          </div>
        )}

        {messages.map(msg => {
          const profile = memberProfiles[msg.user_id];
          return (
            <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="py-3 px-3 rounded-xl hover:bg-muted/15 transition-all border-b border-border/10 last:border-0 group"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-bold text-white mt-0.5"
                  style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}>
                  {(profile?.name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{profile?.name || 'Utilisateur'}</span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {format(new Date(msg.created_at), 'd MMM HH:mm', { locale: fr })}
                    </span>
                  </div>
                  <p className="text-[13px] text-foreground/75 whitespace-pre-wrap break-words leading-relaxed line-clamp-3">
                    {msg.content}
                  </p>
                </div>
                <button onClick={() => onUnpin(msg.id)}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-all shrink-0"
                  title="Désépingler"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
