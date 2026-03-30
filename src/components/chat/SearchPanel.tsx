import { useState } from 'react';
import type { ChatMessage, MemberProfile } from '@/types/chat';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Search } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onSearch: (query: string) => void;
  results: ChatMessage[];
  searching: boolean;
  memberProfiles: Record<string, MemberProfile>;
  onClose: () => void;
}

export function SearchPanel({ onSearch, results, searching, memberProfiles, onClose }: Props) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className="w-full h-full flex flex-col border-l border-border/20 backdrop-blur-2xl bg-card/15 shadow-[inset_1px_0_0_rgba(255,255,255,0.03)]">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border/20 shrink-0 bg-card/20">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Rechercher</h3>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search input */}
      <form onSubmit={handleSubmit} className="px-3 py-3 border-b border-border/15">
        <div className="flex items-center gap-2 backdrop-blur-xl bg-muted/20 border border-border/20 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Chercher des messages…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/35"
            autoFocus
          />
        </div>
      </form>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-2">
        {searching && (
          <div className="flex items-center justify-center py-8">
            <div className="flex gap-1">
              {[0, 100, 200].map(d => (
                <motion.div key={d} className="w-2 h-2 rounded-full bg-primary/40"
                  animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d / 1000 }}
                />
              ))}
            </div>
          </div>
        )}

        {!searching && results.length === 0 && query && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/50">Aucun résultat pour « {query} »</p>
          </div>
        )}

        {!searching && results.length === 0 && !query && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/40">Tape un mot-clé pour rechercher</p>
          </div>
        )}

        {results.map(msg => {
          const profile = memberProfiles[msg.user_id];
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="py-2.5 px-2 rounded-xl hover:bg-muted/20 transition-all cursor-pointer border-b border-border/10 last:border-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ backgroundColor: profile?.avatar_color || '#6366f1' }}>
                  {(profile?.name || '?')[0].toUpperCase()}
                </div>
                <span className="text-xs font-medium text-foreground">{profile?.name || 'Utilisateur'}</span>
                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                  {format(new Date(msg.created_at), 'd MMM HH:mm', { locale: fr })}
                </span>
              </div>
              <p className="text-[13px] text-foreground/75 line-clamp-2 leading-relaxed pl-8">{msg.content}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
