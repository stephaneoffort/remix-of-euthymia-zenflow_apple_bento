import { useState, useEffect, useMemo } from 'react';
import type { ChatMessage, MemberProfile } from '@/types/chat';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { X, Search, User, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onSearch: (query: string, authorId?: string | null) => void;
  results: ChatMessage[];
  searching: boolean;
  memberProfiles: Record<string, MemberProfile>;
  onClose: () => void;
}

export function SearchPanel({ onSearch, results, searching, memberProfiles, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [authorId, setAuthorId] = useState<string | null>(null);
  const [authorMenuOpen, setAuthorMenuOpen] = useState(false);

  // Author options from currently known profiles
  const authorOptions = useMemo(() => {
    return Object.entries(memberProfiles)
      .map(([id, p]) => ({ id, name: p?.name || 'Utilisateur', color: p?.avatar_color || '#6366f1' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [memberProfiles]);

  const selectedAuthor = authorId ? authorOptions.find(a => a.id === authorId) : null;

  // Debounced live search on query/author change
  useEffect(() => {
    const t = setTimeout(() => {
      if (query.trim() || authorId) {
        onSearch(query.trim(), authorId);
      } else {
        onSearch('', null);
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, authorId]);

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

      {/* Filters */}
      <div className="px-3 py-3 border-b border-border/15 space-y-2">
        {/* Keyword input */}
        <div className="flex items-center gap-2 backdrop-blur-xl bg-muted/20 border border-border/20 rounded-xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
          <Search className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Mots-clés…"
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/35"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground" title="Effacer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Author filter */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setAuthorMenuOpen(o => !o)}
            className="w-full flex items-center gap-2 backdrop-blur-xl bg-muted/20 border border-border/20 rounded-xl px-3 py-2 text-sm text-left hover:bg-muted/30 transition-all"
          >
            {selectedAuthor ? (
              <>
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: selectedAuthor.color }}>
                  {selectedAuthor.name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 truncate text-foreground">{selectedAuthor.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setAuthorId(null); }}
                  className="p-0.5 rounded text-muted-foreground/60 hover:text-foreground"
                  title="Retirer le filtre auteur"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                <span className="flex-1 text-muted-foreground/60">Tous les auteurs</span>
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/60" />
              </>
            )}
          </button>

          {authorMenuOpen && (
            <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-60 overflow-y-auto scrollbar-thin rounded-xl border border-border/20 bg-popover text-popover-foreground shadow-lg backdrop-blur-2xl">
              <button
                onClick={() => { setAuthorId(null); setAuthorMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/40 text-left"
              >
                <User className="w-4 h-4 text-muted-foreground/60" />
                <span>Tous les auteurs</span>
              </button>
              {authorOptions.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground/60">Aucun auteur disponible</p>
              )}
              {authorOptions.map(a => (
                <button
                  key={a.id}
                  onClick={() => { setAuthorId(a.id); setAuthorMenuOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/40 ${authorId === a.id ? 'bg-muted/30' : ''}`}
                >
                  <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ backgroundColor: a.color }}>
                    {a.name[0]?.toUpperCase()}
                  </div>
                  <span className="truncate">{a.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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

        {!searching && results.length === 0 && (query || authorId) && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/60">Aucun résultat</p>
          </div>
        )}

        {!searching && results.length === 0 && !query && !authorId && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/50">Tape un mot-clé ou choisis un auteur</p>
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
                <span className="text-[10px] text-muted-foreground/60 ml-auto">
                  {format(new Date(msg.created_at), 'd MMM HH:mm', { locale: fr })}
                </span>
              </div>
              <p className="text-[13px] text-foreground/80 line-clamp-2 leading-relaxed pl-8">{msg.content}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
