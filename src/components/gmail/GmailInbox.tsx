import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, RefreshCw, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';

interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  isUnread: boolean;
}

interface GmailInboxProps {
  compact?: boolean;
}

function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  return { name: from, email: from };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function GmailInbox({ compact }: GmailInboxProps) {
  const { isActive } = useIntegrations();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isActive('gmail')) return null;

  const fetchMessages = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ maxResults: '8' });
      if (query) params.set('q', query);

      const { data, error } = await supabase.functions.invoke('gmail-list', {
        body: null,
        headers: {},
      });

      // Use GET with query params via fetch
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/gmail-list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setMessages(result.messages ?? []);
      setLoaded(true);
    } catch (err) {
      console.error('Gmail list error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      fetchMessages();
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMessages(search || undefined);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleOpen}
        className={`flex items-center justify-between w-full ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <span className="font-medium text-foreground flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.gmail.icon} alt="Gmail" className="w-5 h-5" />
          Emails reçus
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
          {/* Search + refresh */}
          <form onSubmit={handleSearch} className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-xs h-7 pl-7"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => fetchMessages(search || undefined)}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </form>

          {/* Messages list */}
          {loading && !loaded ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Aucun email trouvé</p>
          ) : (
            <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-thin">
              {messages.map(msg => {
                const { name, email } = parseFrom(msg.from);
                const isExpanded = expandedId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`rounded-lg border transition-colors cursor-pointer ${
                      msg.isUnread
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-background'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : msg.id)}
                      className="w-full text-left p-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs truncate ${msg.isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                              {name}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {formatDate(msg.date)}
                            </span>
                          </div>
                          <p className={`text-xs truncate ${msg.isUnread ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
                            {msg.subject || '(sans objet)'}
                          </p>
                          {!isExpanded && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {msg.snippet}
                            </p>
                          )}
                        </div>
                        {msg.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-2.5 pb-2.5 pt-0 border-t border-border/50">
                        <div className="text-[10px] text-muted-foreground space-y-0.5 mb-2 pt-2">
                          <p><span className="font-medium">De :</span> {msg.from}</p>
                          <p><span className="font-medium">À :</span> {msg.to}</p>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-line leading-relaxed">
                          {msg.snippet}
                        </p>
                        <a
                          href={`https://mail.google.com/mail/u/0/#inbox/${msg.threadId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-2"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" /> Ouvrir dans Gmail
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
