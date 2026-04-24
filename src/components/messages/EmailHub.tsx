import { useEffect, useMemo, useState } from 'react';
import {
  Mail, Plus, Trash2, RefreshCw, Send, Reply, Inbox, AlertCircle, X, Check, Loader2,
  History, ChevronDown, ChevronUp, Search, Star, Archive, Clock, Tag, AtSign, Newspaper,
  CornerUpLeft, MoreHorizontal, Paperclip, Download, ArrowLeft, Menu,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEmailAccounts, useEmailMessages, sendEmail, emailAction, EmailAccount, EmailMessage } from '@/hooks/useEmailAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import gmailLogo from '@/assets/integrations/gmail.png';

type View = 'list' | 'detail' | 'compose' | 'add-account' | 'choose-provider';

// ----- Pièces jointes : helpers -----
interface AttachmentInfo {
  name: string;
  size?: number;
  mimeType?: string;
  url?: string;
}

function getAttachmentList(msg: { attachments?: any; has_attachments?: boolean }): AttachmentInfo[] {
  const raw = msg.attachments;
  if (!raw) return [];
  let arr: any[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) arr = parsed; } catch { return []; }
  } else if (typeof raw === 'object') {
    arr = [raw];
  }
  return arr
    .map((a): AttachmentInfo | null => {
      if (!a) return null;
      const name = a.name || a.filename || a.file_name || a.title || 'pièce jointe';
      const size = typeof a.size === 'number' ? a.size : typeof a.file_size === 'number' ? a.file_size : undefined;
      const mimeType = a.mime_type || a.mimeType || a.contentType || a.content_type;
      const url = a.url || a.download_url || a.href;
      return { name, size, mimeType, url };
    })
    .filter((a): a is AttachmentInfo => a !== null);
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

function AttachmentBadge({ count, className = '' }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums ${className}`}
      title={`${count} pièce${count > 1 ? 's' : ''} jointe${count > 1 ? 's' : ''}`}
    >
      <Paperclip className="w-3 h-3" />
      {count}
    </span>
  );
}

function AttachmentList({ attachments }: { attachments: AttachmentInfo[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        <Paperclip className="w-3 h-3" />
        {attachments.length} pièce{attachments.length > 1 ? 's' : ''} jointe{attachments.length > 1 ? 's' : ''}
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {attachments.map((att, i) => {
          const ext = att.name.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE';
          const Inner = (
            <>
              <span className="shrink-0 w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                {ext}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-medium text-foreground truncate" title={att.name}>
                  {att.name}
                </span>
                {att.size != null && (
                  <span className="block text-[10px] text-muted-foreground">{formatFileSize(att.size)}</span>
                )}
              </span>
              {att.url && <Download className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
            </>
          );
          return (
            <li key={i}>
              {att.url ? (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.name}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 p-2 rounded-md border border-border bg-card hover:bg-muted/60 hover:border-primary/40 transition-colors"
                >
                  {Inner}
                </a>
              ) : (
                <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
                  {Inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}


// Historique local des échecs d'auto-import Gmail
const IMPORT_HISTORY_KEY = 'gmail_autoimport_failures';
const MAX_HISTORY = 20;

interface ImportFailure {
  timestamp: number;
  step: 'connexion' | 'synchronisation' | 'verification' | 'inconnue';
  message: string;
  code?: string | number | null;
}

function loadFailureHistory(): ImportFailure[] {
  try {
    const raw = localStorage.getItem(IMPORT_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveFailure(entry: ImportFailure) {
  try {
    const list = loadFailureHistory();
    const next = [entry, ...list].slice(0, MAX_HISTORY);
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

function clearFailureHistory() {
  try {
    localStorage.removeItem(IMPORT_HISTORY_KEY);
  } catch {}
}

function inferStep(msg: string): ImportFailure['step'] {
  const m = msg.toLowerCase();
  if (m.includes('session') || m.includes('auth') || m.includes('token')) return 'connexion';
  if (m.includes('sync') || m.includes('insert') || m.includes('import')) return 'synchronisation';
  if (m.includes('check') || m.includes('verif') || m.includes('exist')) return 'verification';
  return 'inconnue';
}

export default function EmailHub() {
  const queryClient = useQueryClient();
  const {
    accounts, isLoading, addImapAccount, deleteAccount, syncAccount,
    connectGmail, importLegacyGmail,
  } = useEmailAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [replyTo, setReplyTo] = useState<EmailMessage | null>(null);
  const [failureHistory, setFailureHistory] = useState<ImportFailure[]>(() => loadFailureHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  // Log chaque nouvel échec d'auto-import dans l'historique local
  useEffect(() => {
    if (importLegacyGmail.isError) {
      const err = importLegacyGmail.error as any;
      const message = err?.message || 'Erreur inconnue';
      const code = err?.code || err?.status || err?.response?.status || null;
      const entry: ImportFailure = {
        timestamp: Date.now(),
        step: inferStep(message),
        message,
        code,
      };
      // Évite de re-logger le même échec à chaque re-render
      const last = failureHistory[0];
      if (!last || last.message !== message || Math.abs(last.timestamp - entry.timestamp) > 2000) {
        saveFailure(entry);
        setFailureHistory(loadFailureHistory());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importLegacyGmail.isError, importLegacyGmail.error]);

  // Auto-import legacy Gmail connection on mount (one-shot)
  useEffect(() => {
    if (!isLoading && accounts.length === 0) {
      importLegacyGmail.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Auto-select first account
  if (!selectedAccountId && accounts.length > 0) {
    setSelectedAccountId(accounts[0].id);
  }

  const account = accounts.find(a => a.id === selectedAccountId);
  const { data: messages = [], isLoading: loadingMessages } = useEmailMessages(selectedAccountId);

  const handleSync = () => {
    if (account) syncAccount.mutate(account);
  };

  const handleDelete = async (msg: EmailMessage, opts?: { skipConfirm?: boolean; keepView?: boolean }) => {
    if (!account) return;
    if (!opts?.skipConfirm && !confirm('Supprimer cet email ?')) return;
    try {
      await emailAction({ account_id: account.id, message_id: msg.id, action: 'delete' });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      if (!opts?.keepView) {
        setView('list');
        setSelectedMessage(null);
      }
      toast.success('Email supprimé');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleQuickReply = (msg: EmailMessage) => {
    setReplyTo(msg);
    setSelectedMessage(msg);
    setView('compose');
  };

  const handleQuickDelete = async (msg: EmailMessage) => {
    const sender = msg.from_name || msg.from_address;
    const subject = msg.subject || '(sans objet)';
    const ok = confirm(
      `Supprimer définitivement cet email ?\n\nDe : ${sender}\nObjet : ${subject}\n\nCette action est irréversible.`
    );
    if (!ok) return;
    await handleDelete(msg, { skipConfirm: true, keepView: true });
  };

  const handleMarkRead = async (msg: EmailMessage) => {
    if (!account || msg.is_read) return;
    try {
      await emailAction({ account_id: account.id, message_id: msg.id, action: 'mark_read' });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    } catch {}
  };

  // Auto-import en cours : afficher une progression par étapes
  if (isLoading || importLegacyGmail.isPending) {
    // Étape courante : 0=connexion, 1=synchronisation, 2=vérification
    const currentStep = isLoading ? 0 : importLegacyGmail.isPending ? 1 : 2;
    return <ImportProgress currentStep={currentStep} />;
  }

  // Auto-import a échoué : afficher l'erreur + actions de récupération
  if (importLegacyGmail.isError && accounts.length === 0) {
    const err = importLegacyGmail.error as any;
    const errMsg = err?.message || 'Erreur inconnue';
    const errCode = err?.code || err?.status || (err?.response?.status) || null;
    const fullError = err?.toString ? err.toString() : JSON.stringify(err, null, 2);
    return (
      <div className="flex flex-col items-center justify-start h-full gap-4 text-center px-6 py-8 overflow-y-auto">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-foreground">Import Gmail impossible</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">{errMsg}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => importLegacyGmail.mutate()}
            disabled={importLegacyGmail.isPending}
          >
            {importLegacyGmail.isPending ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            Réessayer l'auto-import
          </Button>
          <Button size="sm" onClick={connectGmail}>
            <Mail className="w-4 h-4 mr-1.5" /> Reconnecter Gmail
          </Button>
        </div>

        {/* Diagnostic technique */}
        <div className="w-full max-w-sm mt-2 text-left">
          <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Diagnostic technique</span>
            </div>
            {errCode && (
              <p className="text-xs font-mono text-destructive/90">
                <span className="font-semibold">Code :</span> {errCode}
              </p>
            )}
            <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
              {fullError}
            </pre>
          </div>
        </div>

        {/* Historique des échecs */}
        <FailureHistoryPanel
          history={failureHistory}
          open={historyOpen}
          onToggle={() => setHistoryOpen(o => !o)}
          onClear={() => {
            clearFailureHistory();
            setFailureHistory([]);
          }}
        />
      </div>
    );
  }

  // Empty state — show provider chooser instead of a giant IMAP form
  if (accounts.length === 0) {
    return (
      <ProviderChooser
        onPickGmail={connectGmail}
        onPickImap={() => setView('add-account')}
        embedded={false}
      />
    );
  }

  if (view === 'choose-provider') {
    return (
      <ProviderChooser
        onPickGmail={connectGmail}
        onPickImap={() => setView('add-account')}
        onCancel={() => setView('list')}
        embedded
      />
    );
  }

  if (view === 'add-account') {
    return (
      <AddAccountForm
        onSubmit={(p) => {
          addImapAccount.mutate(p, {
            onSuccess: () => setView('list'),
          });
        }}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'compose' && account) {
    return (
      <ComposeView
        account={account}
        replyTo={replyTo}
        onCancel={() => {
          setView(selectedMessage ? 'detail' : 'list');
          setReplyTo(null);
        }}
        onSent={() => {
          setView('list');
          setReplyTo(null);
          setSelectedMessage(null);
          toast.success('Email envoyé');
        }}
      />
    );
  }

  // Note: la vue 'detail' est maintenant intégrée comme 3e colonne dans la vue 'list'

  return (
    <NotionMailLayout
      accounts={accounts}
      selectedAccountId={selectedAccountId}
      setSelectedAccountId={(id) => { setSelectedAccountId(id); setSelectedMessage(null); }}
      account={account}
      messages={messages}
      loadingMessages={loadingMessages}
      selectedMessage={selectedMessage}
      onSelectMessage={(m) => { setSelectedMessage(m); handleMarkRead(m); }}
      onSync={handleSync}
      syncing={syncAccount.isPending}
      onAddAccount={() => setView('choose-provider')}
      onCompose={() => { setReplyTo(null); setSelectedMessage(null); setView('compose'); }}
      onReply={(m) => { setReplyTo(m); setSelectedMessage(m); setView('compose'); }}
      onDelete={handleQuickDelete}
      onMarkRead={handleMarkRead}
      onCloseDetail={() => setSelectedMessage(null)}
    />
  );
}

// ============================================================================
// Notion Mail-style 3-column layout
// ============================================================================

type FilterTab = 'all' | 'unread' | 'mentions' | 'newsletters' | 'starred';

interface NotionMailLayoutProps {
  accounts: EmailAccount[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string) => void;
  account: EmailAccount | undefined;
  messages: EmailMessage[];
  loadingMessages: boolean;
  selectedMessage: EmailMessage | null;
  onSelectMessage: (m: EmailMessage) => void;
  onSync: () => void;
  syncing: boolean;
  onAddAccount: () => void;
  onCompose: () => void;
  onReply: (m: EmailMessage) => void;
  onDelete: (m: EmailMessage) => void;
  onMarkRead: (m: EmailMessage) => void;
  onCloseDetail: () => void;
}

function NotionMailLayout({
  accounts, selectedAccountId, setSelectedAccountId, account,
  messages, loadingMessages, selectedMessage, onSelectMessage,
  onSync, syncing, onAddAccount, onCompose, onReply, onDelete, onMarkRead, onCloseDetail,
}: NotionMailLayoutProps) {
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = messages;
    if (tab === 'unread') list = list.filter(m => !m.is_read);
    else if (tab === 'starred') list = list.filter(m => m.is_starred);
    else if (tab === 'mentions') {
      const me = account?.email_address?.toLowerCase() || '';
      list = list.filter(m =>
        (m.body_text?.toLowerCase().includes(`@${me.split('@')[0]}`) ?? false) ||
        (m.to_addresses?.some(a => a.toLowerCase() === me) ?? false)
      );
    } else if (tab === 'newsletters') {
      list = list.filter(m => {
        const f = (m.from_address || '').toLowerCase();
        const s = (m.subject || '').toLowerCase();
        return f.includes('newsletter') || f.includes('noreply') || f.includes('no-reply')
          || f.includes('mailer') || s.includes('newsletter') || s.includes('unsubscribe');
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.from_name || '').toLowerCase().includes(q) ||
        (m.from_address || '').toLowerCase().includes(q) ||
        (m.preview || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, tab, search, account?.email_address]);

  const counts = useMemo(() => ({
    all: messages.length,
    unread: messages.filter(m => !m.is_read).length,
    starred: messages.filter(m => m.is_starred).length,
  }), [messages]);

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* COLUMN 1 — Accounts / Folders sidebar */}
      <aside className="w-60 shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-3 py-3 border-b border-border">
          <button
            onClick={onCompose}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            Nouveau message
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {/* Comptes */}
          <div>
            <div className="flex items-center justify-between px-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Comptes
              </span>
              <button
                onClick={onAddAccount}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Ajouter un compte"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-0.5">
              {accounts.map(a => {
                const active = a.id === selectedAccountId;
                return (
                  <li key={a.id}>
                    <button
                      onClick={() => setSelectedAccountId(a.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
                        active
                          ? 'bg-foreground/10 text-foreground font-medium'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {a.account_type === 'gmail' ? (
                        <img src={gmailLogo} alt="" className="w-4 h-4 shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate flex-1 min-w-0">{a.email_address}</span>
                      {a.unread_count > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-mono shrink-0">
                          {a.unread_count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Vues */}
          {account && (
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1 block">
                Vues
              </span>
              <ul className="space-y-0.5">
                <SidebarFolder icon={Inbox} label="Réception" count={counts.all} active={tab === 'all'} onClick={() => setTab('all')} />
                <SidebarFolder icon={Mail} label="Non lus" count={counts.unread} active={tab === 'unread'} onClick={() => setTab('unread')} />
                <SidebarFolder icon={AtSign} label="Mentions" active={tab === 'mentions'} onClick={() => setTab('mentions')} />
                <SidebarFolder icon={Newspaper} label="Newsletters" active={tab === 'newsletters'} onClick={() => setTab('newsletters')} />
                <SidebarFolder icon={Star} label="Favoris" count={counts.starred} active={tab === 'starred'} onClick={() => setTab('starred')} />
              </ul>
            </div>
          )}
        </div>
      </aside>

      {/* COLUMN 2 — Message list */}
      <section className={`${selectedMessage ? 'w-[380px] shrink-0' : 'flex-1'} border-r border-border flex flex-col min-w-0 transition-all`}>
        {/* Header: search + sync */}
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans les emails…"
              className="h-8 pl-7 text-xs border-transparent bg-muted/40 focus-visible:bg-background"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSync} disabled={syncing} title="Synchroniser">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>

        {/* Tabs / Views */}
        <div className="px-2 border-b border-border flex items-center gap-0.5 overflow-x-auto scrollbar-thin shrink-0">
          <FilterChip label="Tous" active={tab === 'all'} onClick={() => setTab('all')} count={counts.all} />
          <FilterChip label="Non lus" active={tab === 'unread'} onClick={() => setTab('unread')} count={counts.unread} />
          <FilterChip label="Mentions" active={tab === 'mentions'} onClick={() => setTab('mentions')} />
          <FilterChip label="Newsletters" active={tab === 'newsletters'} onClick={() => setTab('newsletters')} />
          <FilterChip label="Favoris" active={tab === 'starred'} onClick={() => setTab('starred')} count={counts.starred} />
        </div>

        {account?.last_sync_error && (
          <div className="px-3 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{account.last_sync_error}</span>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingMessages ? (
            <p className="text-xs text-muted-foreground text-center py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground px-4">
              <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun email</p>
              {messages.length === 0 && (
                <Button variant="link" onClick={onSync} className="mt-1 text-xs">
                  Synchroniser maintenant
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map(msg => (
                <MessageRow
                  key={msg.id}
                  msg={msg}
                  selected={selectedMessage?.id === msg.id}
                  onClick={() => onSelectMessage(msg)}
                  onReply={() => onReply(msg)}
                  onDelete={() => onDelete(msg)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* COLUMN 3 — Reading pane */}
      {selectedMessage && (
        <section className="flex-1 flex flex-col min-w-0 bg-background">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={onCloseDetail} className="h-8 w-8 p-0" title="Fermer">
              <X className="w-4 h-4" />
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => onReply(selectedMessage)} className="h-8">
              <CornerUpLeft className="w-4 h-4 mr-1.5" /> Répondre
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Archiver">
              <Archive className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => onDelete(selectedMessage)} title="Supprimer">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6">
            <ConversationView
              selectedMessage={selectedMessage}
              allMessages={messages}
              onMarkRead={onMarkRead}
            />
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// Conversation (thread) view inside the reading pane
// ============================================================================

function normalizeSubject(s: string | null | undefined): string {
  return (s || '')
    .replace(/^\s*(re|fw|fwd|tr|rép|ref)\s*:\s*/gi, '')
    .replace(/^\s*(re|fw|fwd|tr|rép|ref)\s*:\s*/gi, '')
    .trim()
    .toLowerCase();
}

function buildThread(selected: EmailMessage, all: EmailMessage[]): EmailMessage[] {
  // 1) Group by explicit thread_id when present
  if (selected.thread_id) {
    const grouped = all.filter(m => m.thread_id && m.thread_id === selected.thread_id);
    if (grouped.length > 1) {
      return [...grouped].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
      );
    }
  }

  // 2) Fallback: same normalized subject + at least one common participant
  const subjectKey = normalizeSubject(selected.subject);
  if (!subjectKey) return [selected];

  const participants = new Set<string>([
    selected.from_address?.toLowerCase(),
    ...(selected.to_addresses || []).map(a => a.toLowerCase()),
    ...(selected.cc_addresses || []).map(a => a.toLowerCase()),
  ].filter(Boolean) as string[]);

  const related = all.filter(m => {
    if (m.id === selected.id) return true;
    if (normalizeSubject(m.subject) !== subjectKey) return false;
    const pp = [
      m.from_address?.toLowerCase(),
      ...(m.to_addresses || []).map(a => a.toLowerCase()),
      ...(m.cc_addresses || []).map(a => a.toLowerCase()),
    ].filter(Boolean) as string[];
    return pp.some(p => participants.has(p));
  });

  if (related.length <= 1) return [selected];
  return related.sort(
    (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  );
}

function ConversationView({
  selectedMessage,
  allMessages,
  onMarkRead,
}: {
  selectedMessage: EmailMessage;
  allMessages: EmailMessage[];
  onMarkRead: (m: EmailMessage) => void;
}) {
  const thread = useMemo(
    () => buildThread(selectedMessage, allMessages),
    [selectedMessage, allMessages]
  );

  const isThread = thread.length > 1;
  // Latest selected by default; older ones collapsed
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    s.add(selectedMessage.id);
    // Also expand the most recent message by default
    const latest = thread[thread.length - 1];
    if (latest) s.add(latest.id);
    return s;
  });

  // Reset expansion when switching to a different selected message / thread
  useEffect(() => {
    const s = new Set<string>();
    s.add(selectedMessage.id);
    const latest = thread[thread.length - 1];
    if (latest) s.add(latest.id);
    setExpandedIds(s);
    // Mark all unread thread items as read on open
    thread.forEach(m => { if (!m.is_read) onMarkRead(m); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMessage.id]);

  const toggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(thread.map(m => m.id)));
  const collapseAll = () => {
    const latest = thread[thread.length - 1];
    setExpandedIds(new Set(latest ? [latest.id] : []));
  };

  const totalAttachments = useMemo(
    () => thread.reduce((sum, m) => sum + getAttachmentList(m).length, 0),
    [thread]
  );

  return (
    <>
      <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-2 leading-snug">
        {selectedMessage.subject?.replace(/^\s*(re|fw|fwd|tr)\s*:\s*/gi, '') || '(sans objet)'}
      </h2>

      {isThread && (
        <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 border border-border">
              <Mail className="w-3 h-3" />
              <span className="font-medium text-foreground">{thread.length}</span>
              <span>messages dans cette conversation</span>
            </span>
            {totalAttachments > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 border border-border">
                <Paperclip className="w-3 h-3" />
                <span className="font-medium text-foreground">{totalAttachments}</span>
                <span>pièce{totalAttachments > 1 ? 's' : ''} jointe{totalAttachments > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={expandAll}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Tout déplier
            </button>
            <button
              onClick={collapseAll}
              className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
            >
              Tout replier
            </button>
          </div>
        </div>
      )}

      <ol className={isThread ? 'space-y-3 relative' : ''}>
        {isThread && (
          <span
            aria-hidden
            className="absolute left-5 top-2 bottom-2 w-px bg-border"
          />
        )}
        {thread.map((msg, idx) => {
          const expanded = expandedIds.has(msg.id);
          const isLast = idx === thread.length - 1;
          const isCurrent = msg.id === selectedMessage.id;

          return (
            <li
              key={msg.id}
              className={`relative ${
                isThread
                  ? `rounded-lg border bg-card transition-all ${
                      isCurrent ? 'border-primary/40 shadow-sm' : 'border-border'
                    }`
                  : ''
              }`}
            >
              {(() => {
                const msgAtts = getAttachmentList(msg);
                return (
                  <>
                    <button
                      onClick={() => toggle(msg.id)}
                      className={`w-full text-left flex items-start gap-3 ${
                        isThread ? 'p-3' : 'pb-4 mb-5 border-b border-border'
                      } ${expanded && isThread ? 'border-b border-border/60' : ''}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0 relative z-10">
                        {(msg.from_name || msg.from_address).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">
                            {msg.from_name || msg.from_address}
                            {!msg.is_read && (
                              <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle" />
                            )}
                          </p>
                          <span className="flex items-center gap-2 shrink-0">
                            <AttachmentBadge count={msgAtts.length} />
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.received_at).toLocaleString('fr-FR', {
                                day: 'numeric', month: 'short',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                          </span>
                        </div>
                        {expanded ? (
                          <>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              &lt;{msg.from_address}&gt;
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              À : <span className="text-foreground/80">{msg.to_addresses.join(', ')}</span>
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {msg.preview || msg.body_text?.slice(0, 140) || '…'}
                            </p>
                            {msgAtts.length > 0 && (
                              <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5 italic">
                                <Paperclip className="inline w-3 h-3 mr-1 -mt-0.5" />
                                {msgAtts.slice(0, 3).map(a => a.name).join(', ')}
                                {msgAtts.length > 3 && ` + ${msgAtts.length - 3}`}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {isThread && (
                        <span className="shrink-0 text-muted-foreground mt-1">
                          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      )}
                    </button>

                    {expanded && (
                      <div className={`${isThread ? 'px-4 pb-4 pt-3' : ''}`}>
                        <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/90 leading-relaxed">
                          {msg.body_html ? (
                            <div dangerouslySetInnerHTML={{ __html: msg.body_html }} />
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-sm">{msg.body_text}</pre>
                          )}
                        </div>
                        <AttachmentList attachments={msgAtts} />
                      </div>
                    )}

                    {!expanded && isThread && !isLast && (
                      <div className="h-2" />
                    )}
                  </>
                );
              })()}
            </li>
          );
        })}
      </ol>
    </>
  );
}

function SidebarFolder({
  icon: Icon, label, count, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left ${
          active
            ? 'bg-foreground/10 text-foreground font-medium'
            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="truncate flex-1 min-w-0">{label}</span>
        {count != null && count > 0 && (
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{count}</span>
        )}
      </button>
    </li>
  );
}

function FilterChip({
  label, active, onClick, count,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
        active
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {label}
        {count != null && count > 0 && (
          <span className={`text-[10px] font-mono ${active ? 'text-foreground/60' : 'text-muted-foreground/70'}`}>
            {count}
          </span>
        )}
      </span>
      {active && (
        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-foreground rounded-full" />
      )}
    </button>
  );
}

function MessageRow({
  msg, selected, onClick, onReply, onDelete,
}: {
  msg: EmailMessage;
  selected: boolean;
  onClick: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      onClick={onClick}
      className={`group relative cursor-pointer transition-colors ${
        selected
          ? 'bg-foreground/[0.06]'
          : !msg.is_read
            ? 'bg-primary/[0.04] hover:bg-muted/60'
            : 'hover:bg-muted/60'
      }`}
    >
      {/* Unread indicator stripe */}
      {!msg.is_read && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary" />
      )}

      <div className="px-4 py-3 pr-3">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-foreground' : 'font-medium text-foreground/85'}`}>
            {msg.from_name || msg.from_address}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {(() => {
              const count = getAttachmentList(msg).length;
              return count > 0 ? <AttachmentBadge count={count} /> : null;
            })()}
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatDistanceToNow(new Date(msg.received_at), { addSuffix: false, locale: fr })}
            </span>
          </span>
        </div>
        <p className={`text-[13px] truncate leading-snug ${!msg.is_read ? 'text-foreground' : 'text-foreground/75'}`}>
          {msg.subject || '(sans objet)'}
        </p>
        {msg.preview && (
          <p className="text-xs text-muted-foreground truncate mt-0.5 leading-snug">
            {msg.preview}
          </p>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onReply(); }}
          className="h-7 w-7 flex items-center justify-center rounded-md bg-background/95 backdrop-blur border border-border shadow-sm hover:bg-muted text-foreground/80 hover:text-foreground"
          title="Répondre"
        >
          <CornerUpLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); /* archive placeholder */ }}
          className="h-7 w-7 flex items-center justify-center rounded-md bg-background/95 backdrop-blur border border-border shadow-sm hover:bg-muted text-foreground/80 hover:text-foreground"
          title="Archiver"
        >
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-7 w-7 flex items-center justify-center rounded-md bg-background/95 backdrop-blur border border-border shadow-sm hover:bg-muted text-foreground/80 hover:text-destructive"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}

function FailureHistoryPanel({
  history, open, onToggle, onClear,
}: {
  history: ImportFailure[];
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;

  const stepLabel: Record<ImportFailure['step'], string> = {
    connexion: 'Connexion',
    synchronisation: 'Synchronisation',
    verification: 'Vérification',
    inconnue: 'Étape inconnue',
  };

  return (
    <div className="w-full max-w-sm text-left">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 hover:bg-muted transition-colors"
      >
        <div className="flex items-center gap-2 text-foreground">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold">
            Historique des échecs
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-mono">
            {history.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
          <ul className="max-h-64 overflow-y-auto divide-y divide-border">
            {history.map((f, idx) => (
              <li key={idx} className="px-3 py-2 hover:bg-muted/40 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-destructive">
                    {stepLabel[f.step]}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(f.timestamp).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                {f.code != null && (
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Code : <span className="text-foreground">{f.code}</span>
                  </p>
                )}
                <p className="text-xs text-foreground break-words leading-snug">
                  {f.message}
                </p>
              </li>
            ))}
          </ul>
          <div className="px-3 py-2 border-t border-border bg-muted/20 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Vider l'historique
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportProgress({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Connexion', desc: 'Vérification de votre session Gmail' },
    { label: 'Synchronisation', desc: 'Import du compte autorisé' },
    { label: 'Vérification', desc: 'Préparation de votre boîte mail' },
  ];
  const progress = Math.min(100, ((currentStep + 1) / steps.length) * 100);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <img src={gmailLogo} alt="Gmail" className="w-8 h-8" />
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Auto-import Gmail en cours</p>
        <p className="text-xs text-muted-foreground mt-1">
          Aucune action requise — récupération de votre connexion existante.
        </p>
      </div>

      {/* Barre de progression */}
      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Étapes */}
      <ol className="w-full space-y-2.5 text-left">
        {steps.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <li key={step.label} className="flex items-start gap-3">
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary/15 text-primary ring-2 ring-primary/40'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? (
                  <Check className="w-3.5 h-3.5" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  idx + 1
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    done || active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AddAccountForm({
  onSubmit, onCancel, requireFirst,
}: {
  onSubmit: (p: any) => void;
  onCancel: () => void;
  requireFirst?: boolean;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);

  const autoFillProvider = (e: string) => {
    setEmail(e);
    const domain = e.split('@')[1]?.toLowerCase();
    if (!domain) return;
    if (domain.includes('gmail')) {
      setImapHost('imap.gmail.com'); setSmtpHost('smtp.gmail.com');
      setImapPort(993); setSmtpPort(465); setSmtpSecure(true);
    } else if (domain.includes('yahoo')) {
      setImapHost('imap.mail.yahoo.com'); setSmtpHost('smtp.mail.yahoo.com');
      setImapPort(993); setSmtpPort(465); setSmtpSecure(true);
    } else if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) {
      setImapHost('outlook.office365.com'); setSmtpHost('smtp.office365.com');
      setImapPort(993); setSmtpPort(587); setSmtpSecure(true);
    } else if (domain.includes('ovh')) {
      setImapHost('ssl0.ovh.net'); setSmtpHost('ssl0.ovh.net');
      setImapPort(993); setSmtpPort(465);
    }
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email || !password || !imapHost || !smtpHost) {
      toast.error('Tous les champs requis');
      return;
    }
    onSubmit({
      email_address: email,
      display_name: displayName || undefined,
      imap_host: imapHost,
      imap_port: imapPort,
      imap_secure: imapSecure,
      imap_username: email,
      imap_password: password,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      smtp_username: email,
      smtp_password: password,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          {requireFirst ? 'Connecter votre première boîte mail' : 'Ajouter un compte email'}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          IMAP/SMTP : Gmail, Yahoo, Outlook, OVH, ou n'importe quel hébergeur. Astuce : utilisez un <strong>mot de passe d'application</strong> (pas votre mot de passe principal).
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <div>
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email" type="email" value={email}
            onChange={(e) => autoFillProvider(e.target.value)}
            placeholder="vous@example.com" required
          />
        </div>
        <div>
          <Label htmlFor="display">Nom affiché (optionnel)</Label>
          <Input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Stéphane Offort" />
        </div>
        <div>
          <Label htmlFor="pass">Mot de passe (ou mot de passe d'application)</Label>
          <Input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="col-span-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Réception (IMAP)</h3>
          </div>
          <div className="col-span-2">
            <Label>Serveur IMAP</Label>
            <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.example.com" required />
          </div>
          <div>
            <Label>Port</Label>
            <Input type="number" value={imapPort} onChange={(e) => setImapPort(parseInt(e.target.value) || 993)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={imapSecure} onCheckedChange={setImapSecure} id="imap-tls" />
            <Label htmlFor="imap-tls" className="cursor-pointer">SSL/TLS</Label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="col-span-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Envoi (SMTP)</h3>
          </div>
          <div className="col-span-2">
            <Label>Serveur SMTP</Label>
            <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" required />
          </div>
          <div>
            <Label>Port</Label>
            <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value) || 587)} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} id="smtp-tls" />
            <Label htmlFor="smtp-tls" className="cursor-pointer">SSL/TLS</Label>
          </div>
        </div>
      </div>
      <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
        {!requireFirst && (
          <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        )}
        <Button type="submit">
          <Check className="w-4 h-4 mr-1.5" /> Connecter
        </Button>
      </div>
    </form>
  );
}

function ComposeView({
  account, replyTo, onCancel, onSent,
}: {
  account: EmailAccount;
  replyTo: EmailMessage | null;
  onCancel: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(replyTo?.from_address || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject?.replace(/^Re:\s*/i, '') || ''}` : ''
  );
  const [body, setBody] = useState(
    replyTo
      ? `\n\n---\nLe ${new Date(replyTo.received_at).toLocaleString('fr-FR')}, ${replyTo.from_address} a écrit :\n${(replyTo.body_text || '').split('\n').map(l => `> ${l}`).join('\n')}`
      : ''
  );
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('Destinataire et sujet requis');
      return;
    }
    setSending(true);
    try {
      await sendEmail({
        account_id: account.id,
        to: to.split(',').map(s => s.trim()).filter(Boolean),
        cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        subject,
        body,
        in_reply_to: replyTo?.external_id,
      });
      onSent();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Annuler
        </Button>
        <span className="text-sm text-muted-foreground">depuis {account.email_address}</span>
        <div className="flex-1" />
        <Button size="sm" onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
          Envoyer
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        <div>
          <Label>À</Label>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinataire@example.com (séparez par des virgules)" />
        </div>
        <div>
          <Label>Cc (optionnel)</Label>
          <Input value={cc} onChange={(e) => setCc(e.target.value)} />
        </div>
        <div>
          <Label>Sujet</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className="font-sans"
          />
        </div>
      </div>
    </div>
  );
}

function ProviderChooser({
  onPickGmail, onPickImap, onCancel, embedded,
}: {
  onPickGmail: () => void;
  onPickImap: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {embedded ? 'Ajouter un compte email' : 'Connecter une boîte mail'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Choisissez votre fournisseur. Vous pouvez ajouter plusieurs comptes.
          </p>
        </div>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 grid sm:grid-cols-2 gap-3">
        <button
          onClick={onPickGmail}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
        >
          <img src={gmailLogo} alt="Gmail" className="w-10 h-10" />
          <div>
            <h3 className="font-semibold text-sm">Gmail</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connexion sécurisée via Google. Idéal — pas de mot de passe à saisir.
            </p>
          </div>
          <span className="mt-auto text-xs text-primary font-medium group-hover:underline">
            Se connecter avec Google →
          </span>
        </button>
        <button
          onClick={onPickImap}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Mail className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Autre (IMAP/SMTP)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Yahoo, Outlook, OVH, ProtonMail, hébergement perso… Configuration manuelle.
            </p>
          </div>
          <span className="mt-auto text-xs text-primary font-medium group-hover:underline">
            Configurer manuellement →
          </span>
        </button>
      </div>
    </div>
  );
}
