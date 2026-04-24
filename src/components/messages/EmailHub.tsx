import { useEffect, useState } from 'react';
import {
  Mail, Plus, Trash2, RefreshCw, Send, Reply, Inbox,
  AlertCircle, X, Check, Loader2, History, ChevronDown,
  ChevronUp, Edit3, FileText,
} from 'lucide-react';
import {
  useEmailAccounts, useEmailMessages, sendEmail, emailAction,
  EmailAccount, EmailMessage,
} from '@/hooks/useEmailAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isToday, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import gmailLogo from '@/assets/integrations/gmail.png';

type View = 'list' | 'compose' | 'add-account' | 'choose-provider';
type Folder = 'inbox' | 'sent';

/* ─── Helpers ─── */

function formatEmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'HH:mm');
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff < 7) return format(d, 'EEE', { locale: fr });
    return format(d, 'd MMM', { locale: fr });
  } catch {
    return '';
  }
}

const AVATAR_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
];
function senderColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

/* ─── Failure history (local storage) ─── */
const IMPORT_HISTORY_KEY = 'gmail_autoimport_failures';
interface ImportFailure {
  timestamp: number;
  step: 'connexion' | 'synchronisation' | 'verification' | 'inconnue';
  message: string;
  code?: string | number | null;
}
function loadFailureHistory(): ImportFailure[] {
  try { const r = localStorage.getItem(IMPORT_HISTORY_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}
function saveFailure(entry: ImportFailure) {
  try {
    const list = loadFailureHistory();
    localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify([entry, ...list].slice(0, 20)));
  } catch {}
}
function clearFailureHistory() { try { localStorage.removeItem(IMPORT_HISTORY_KEY); } catch {} }
function inferStep(msg: string): ImportFailure['step'] {
  const m = msg.toLowerCase();
  if (m.includes('session') || m.includes('auth') || m.includes('token')) return 'connexion';
  if (m.includes('sync') || m.includes('insert') || m.includes('import')) return 'synchronisation';
  if (m.includes('check') || m.includes('verif') || m.includes('exist')) return 'verification';
  return 'inconnue';
}

/* ─── Sub-components ─── */

function FolderBtn({
  icon: Icon, label, active, count, onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
        active
          ? 'bg-accent text-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      {!!count && count > 0 && (
        <span className="text-[10px] font-semibold bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 leading-none">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

function EmailRowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border animate-pulse">
      <div className="w-8 h-8 rounded-full bg-muted shrink-0 mt-0.5" />
      <div className="flex-1 space-y-1.5">
        <div className="flex justify-between gap-2">
          <div className="h-3 bg-muted rounded w-28" />
          <div className="h-3 bg-muted rounded w-10 shrink-0" />
        </div>
        <div className="h-3 bg-muted rounded w-40" />
        <div className="h-3 bg-muted rounded w-52" />
      </div>
    </div>
  );
}

function EmailRow({
  msg, selected, onClick, onReply, onDelete,
}: {
  msg: EmailMessage;
  selected: boolean;
  onClick: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const sender = msg.from_name || msg.from_address;
  const initial = sender.charAt(0).toUpperCase();
  const color = senderColor(sender);

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors ${
        selected ? 'bg-accent' : msg.is_read ? 'hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'
      }`}
      onClick={onClick}
    >
      {/* Unread dot */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5">
        {!msg.is_read && (
          <span className="block w-1.5 h-1.5 rounded-full bg-primary" />
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-baseline justify-between gap-2 mb-0.5">
          <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
            {sender}
          </span>
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
            {formatEmailDate(msg.received_at)}
          </span>
        </div>
        <p className={`text-sm truncate ${!msg.is_read ? 'font-medium text-foreground' : 'text-foreground/70'}`}>
          {msg.subject || '(sans objet)'}
        </p>
        {msg.preview && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.preview}</p>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded-md shadow-sm px-0.5">
        <button
          title="Répondre"
          onClick={e => { e.stopPropagation(); onReply(); }}
          className="p-1.5 hover:bg-accent rounded transition-colors"
        >
          <Reply className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          title="Supprimer"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    </div>
  );
}

function ReadingPane({
  message, onBack, onReply, onDelete,
}: {
  message: EmailMessage;
  onBack: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const sender = message.from_name || message.from_address;
  const color = senderColor(sender);
  const initial = sender.charAt(0).toUpperCase();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          ←
        </button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onReply}>
          <Reply className="w-3.5 h-3.5" /> Répondre
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Subject */}
        <h2 className="text-lg font-semibold text-foreground mb-4 leading-snug">
          {message.subject || '(sans objet)'}
        </h2>

        {/* Sender info */}
        <div className="flex items-start gap-3 mb-5 pb-4 border-b border-border">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{sender}</span>
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {new Date(message.received_at).toLocaleString('fr-FR', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              à {message.to_addresses.join(', ')}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {message.body_html ? (
            <div dangerouslySetInnerHTML={{ __html: message.body_html }} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
              {message.body_text || '(aucun contenu)'}
            </pre>
          )}
        </div>
      </div>

      {/* Quick reply footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={onReply}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Reply className="w-3.5 h-3.5" />
          Répondre à {sender}…
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export default function EmailHub() {
  const queryClient = useQueryClient();
  const {
    accounts, isLoading, addImapAccount, syncAccount,
    connectGmail, importLegacyGmail,
  } = useEmailAccounts();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [replyTo, setReplyTo] = useState<EmailMessage | null>(null);
  const [folder, setFolder] = useState<Folder>('inbox');
  const [failureHistory, setFailureHistory] = useState<ImportFailure[]>(() => loadFailureHistory());
  const [historyOpen, setHistoryOpen] = useState(false);

  /* Log import failures */
  useEffect(() => {
    if (importLegacyGmail.isError) {
      const err = importLegacyGmail.error as any;
      const message = err?.message || 'Erreur inconnue';
      const code = err?.code || err?.status || err?.response?.status || null;
      const entry: ImportFailure = { timestamp: Date.now(), step: inferStep(message), message, code };
      const last = failureHistory[0];
      if (!last || last.message !== message || Math.abs(last.timestamp - entry.timestamp) > 2000) {
        saveFailure(entry);
        setFailureHistory(loadFailureHistory());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importLegacyGmail.isError, importLegacyGmail.error]);

  /* Auto-import legacy Gmail on mount */
  useEffect(() => {
    if (!isLoading && accounts.length === 0) importLegacyGmail.mutate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  /* Auto-select first account */
  if (!selectedAccountId && accounts.length > 0) setSelectedAccountId(accounts[0].id);

  const account = accounts.find(a => a.id === selectedAccountId);
  const { data: messages = [], isLoading: loadingMessages } = useEmailMessages(selectedAccountId);

  /* ─── Actions ─── */
  const handleMarkRead = async (msg: EmailMessage) => {
    if (!account || msg.is_read) return;
    try {
      await emailAction({ account_id: account.id, message_id: msg.id, action: 'mark_read' });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      queryClient.invalidateQueries({ queryKey: ['email-accounts'] });
    } catch {}
  };

  const handleDelete = async (msg: EmailMessage) => {
    if (!account) return;
    if (!confirm('Supprimer cet email ?')) return;
    try {
      await emailAction({ account_id: account.id, message_id: msg.id, action: 'delete' });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      setSelectedMessage(null);
      toast.success('Email supprimé');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleQuickDelete = async (msg: EmailMessage) => {
    if (!account) return;
    const sender = msg.from_name || msg.from_address;
    if (!confirm(`Supprimer définitivement cet email ?\n\nDe : ${sender}\nObjet : ${msg.subject || '(sans objet)'}`)) return;
    try {
      await emailAction({ account_id: account.id, message_id: msg.id, action: 'delete' });
      queryClient.invalidateQueries({ queryKey: ['email-messages'] });
      if (selectedMessage?.id === msg.id) setSelectedMessage(null);
      toast.success('Email supprimé');
    } catch (e: any) { toast.error(e.message); }
  };

  /* ─── Loading / Error / Empty states ─── */
  if (isLoading || importLegacyGmail.isPending) {
    const step = isLoading ? 0 : 1;
    return <ImportProgress currentStep={step} />;
  }

  if (importLegacyGmail.isError && accounts.length === 0) {
    const err = importLegacyGmail.error as any;
    return (
      <div className="flex flex-col items-center justify-start h-full gap-4 text-center px-6 py-8 overflow-y-auto">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-foreground">Import Gmail impossible</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">{err?.message || 'Erreur inconnue'}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => importLegacyGmail.mutate()} disabled={importLegacyGmail.isPending}>
            {importLegacyGmail.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Réessayer
          </Button>
          <Button size="sm" onClick={connectGmail}>
            <Mail className="w-4 h-4 mr-1.5" /> Reconnecter Gmail
          </Button>
        </div>
        <FailureHistoryPanel
          history={failureHistory}
          open={historyOpen}
          onToggle={() => setHistoryOpen(o => !o)}
          onClear={() => { clearFailureHistory(); setFailureHistory([]); }}
        />
      </div>
    );
  }

  if (accounts.length === 0) {
    return <ProviderChooser onPickGmail={connectGmail} onPickImap={() => setView('add-account')} />;
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
        onSubmit={p => addImapAccount.mutate(p, { onSuccess: () => setView('list') })}
        onCancel={() => setView('list')}
      />
    );
  }

  if (view === 'compose' && account) {
    return (
      <ComposeView
        account={account}
        replyTo={replyTo}
        onCancel={() => { setView('list'); setReplyTo(null); }}
        onSent={() => { setView('list'); setReplyTo(null); setSelectedMessage(null); toast.success('Email envoyé'); }}
      />
    );
  }

  /* ─── Main layout ─── */
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="hidden sm:flex w-48 shrink-0 flex-col border-r border-border bg-muted/20 py-3 px-2 gap-1">
        <Button
          size="sm"
          className="w-full justify-start gap-2 mb-3"
          onClick={() => { setReplyTo(null); setView('compose'); }}
        >
          <Edit3 className="w-3.5 h-3.5" /> Nouveau message
        </Button>

        <nav className="space-y-0.5">
          <FolderBtn
            icon={Inbox}
            label="Boîte de réception"
            active={folder === 'inbox'}
            count={account?.unread_count}
            onClick={() => { setFolder('inbox'); setSelectedMessage(null); }}
          />
          <FolderBtn
            icon={Send}
            label="Envoyés"
            active={folder === 'sent'}
            onClick={() => { setFolder('sent'); setSelectedMessage(null); }}
          />
        </nav>

        {/* Account list + actions */}
        <div className="mt-auto pt-3 border-t border-border space-y-1">
          {accounts.map(a => (
            <button
              key={a.id}
              onClick={() => setSelectedAccountId(a.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                selectedAccountId === a.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[9px] font-bold shrink-0">
                {a.email_address.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs truncate">{a.email_address}</span>
            </button>
          ))}
          <div className="flex gap-1 pt-1">
            <Button
              variant="ghost" size="icon" className="h-6 w-6" title="Synchroniser"
              onClick={() => account && syncAccount.mutate(account)}
              disabled={syncAccount.isPending}
            >
              <RefreshCw className={`w-3 h-3 ${syncAccount.isPending ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Ajouter un compte"
              onClick={() => setView('choose-provider')}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Email list ── */}
      <div className={`flex flex-col border-r border-border overflow-hidden ${
        selectedMessage ? 'hidden md:flex md:w-60 lg:w-72' : 'flex-1 sm:flex-none sm:w-full md:w-60 lg:w-72'
      }`}>
        {/* List header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground">
            {folder === 'inbox' ? 'Boîte de réception' : 'Envoyés'}
            {folder === 'inbox' && !!account?.unread_count && account.unread_count > 0 && (
              <span className="ml-1 text-xs text-muted-foreground font-normal tabular-nums">
                ({account.unread_count})
              </span>
            )}
          </span>
          {/* Mobile: compose button */}
          <Button variant="ghost" size="icon" className="h-7 w-7 sm:hidden"
            onClick={() => { setReplyTo(null); setView('compose'); }}>
            <Edit3 className="w-4 h-4" />
          </Button>
        </div>

        {account?.last_sync_error && (
          <div className="px-3 py-1.5 bg-destructive/10 text-destructive text-xs flex items-center gap-1.5 shrink-0">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{account.last_sync_error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loadingMessages && Array.from({ length: 5 }).map((_, i) => <EmailRowSkeleton key={i} />)}

          {!loadingMessages && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 px-4 text-center">
              <Inbox className="w-10 h-10 text-muted-foreground/25" />
              <p className="text-sm text-muted-foreground">Aucun email</p>
              <Button variant="link" size="sm" onClick={() => account && syncAccount.mutate(account)}>
                Synchroniser
              </Button>
            </div>
          )}

          {messages.map(msg => (
            <EmailRow
              key={msg.id}
              msg={msg}
              selected={selectedMessage?.id === msg.id}
              onClick={() => { setSelectedMessage(msg); handleMarkRead(msg); }}
              onReply={() => { setReplyTo(msg); setView('compose'); }}
              onDelete={() => handleQuickDelete(msg)}
            />
          ))}
        </div>
      </div>

      {/* ── Reading pane ── */}
      {selectedMessage ? (
        <ReadingPane
          message={selectedMessage}
          onBack={() => setSelectedMessage(null)}
          onReply={() => { setReplyTo(selectedMessage); setView('compose'); }}
          onDelete={() => handleDelete(selectedMessage)}
        />
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-muted/10">
          <div className="text-center">
            <Mail className="w-12 h-12 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Sélectionnez un email pour le lire</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── FailureHistoryPanel ─── */

function FailureHistoryPanel({
  history, open, onToggle, onClear,
}: { history: ImportFailure[]; open: boolean; onToggle: () => void; onClear: () => void }) {
  if (history.length === 0) return null;
  const stepLabel: Record<ImportFailure['step'], string> = {
    connexion: 'Connexion', synchronisation: 'Synchronisation', verification: 'Vérification', inconnue: 'Étape inconnue',
  };
  return (
    <div className="w-full max-w-sm text-left">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-border bg-muted/30 hover:bg-muted transition-colors">
        <div className="flex items-center gap-2 text-foreground">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold">Historique des échecs</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-mono">{history.length}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-card overflow-hidden">
          <ul className="max-h-64 overflow-y-auto divide-y divide-border">
            {history.map((f, idx) => (
              <li key={idx} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-destructive">{stepLabel[f.step]}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(f.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {f.code != null && <p className="text-[11px] font-mono text-muted-foreground">Code : <span className="text-foreground">{f.code}</span></p>}
                <p className="text-xs text-foreground break-words leading-snug">{f.message}</p>
              </li>
            ))}
          </ul>
          <div className="px-3 py-2 border-t border-border bg-muted/20 flex justify-end">
            <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3 mr-1" /> Vider l'historique
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ImportProgress ─── */

function ImportProgress({ currentStep }: { currentStep: number }) {
  const steps = [
    { label: 'Connexion', desc: 'Vérification de votre session Gmail' },
    { label: 'Synchronisation', desc: 'Import du compte autorisé' },
    { label: 'Vérification', desc: 'Préparation de votre boîte mail' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-6 max-w-md mx-auto">
      <div className="flex items-center gap-2">
        <img src={gmailLogo} alt="Gmail" className="w-8 h-8" />
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">Auto-import Gmail en cours</p>
        <p className="text-xs text-muted-foreground mt-1">Aucune action requise — récupération de votre connexion existante.</p>
      </div>
      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${Math.min(100, ((currentStep + 1) / steps.length) * 100)}%` }} />
        </div>
      </div>
      <ol className="w-full space-y-2.5 text-left">
        {steps.map((step, idx) => {
          const done = idx < currentStep;
          const active = idx === currentStep;
          return (
            <li key={step.label} className="flex items-start gap-3">
              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-primary ring-2 ring-primary/40' : 'bg-muted text-muted-foreground'}`}>
                {done ? <Check className="w-3.5 h-3.5" /> : active ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : idx + 1}
              </div>
              <div>
                <p className={`text-sm font-medium ${done || active ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─── AddAccountForm ─── */

function AddAccountForm({ onSubmit, onCancel }: { onSubmit: (p: any) => void; onCancel: () => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapSecure, setImapSecure] = useState(true);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(true);

  const autoFill = (e: string) => {
    setEmail(e);
    const d = e.split('@')[1]?.toLowerCase();
    if (!d) return;
    if (d.includes('gmail')) { setImapHost('imap.gmail.com'); setSmtpHost('smtp.gmail.com'); setSmtpPort(465); setSmtpSecure(true); }
    else if (d.includes('yahoo')) { setImapHost('imap.mail.yahoo.com'); setSmtpHost('smtp.mail.yahoo.com'); setSmtpPort(465); setSmtpSecure(true); }
    else if (d.includes('outlook') || d.includes('hotmail') || d.includes('live')) { setImapHost('outlook.office365.com'); setSmtpHost('smtp.office365.com'); setSmtpPort(587); }
    else if (d.includes('ovh')) { setImapHost('ssl0.ovh.net'); setSmtpHost('ssl0.ovh.net'); setSmtpPort(465); }
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email || !password || !imapHost || !smtpHost) { toast.error('Tous les champs requis'); return; }
    onSubmit({ email_address: email, display_name: displayName || undefined, imap_host: imapHost, imap_port: imapPort, imap_secure: imapSecure, imap_username: email, imap_password: password, smtp_host: smtpHost, smtp_port: smtpPort, smtp_secure: smtpSecure, smtp_username: email, smtp_password: password });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> Ajouter un compte email</h2>
        <p className="text-xs text-muted-foreground mt-1">Utilisez un <strong>mot de passe d'application</strong>, pas votre mot de passe principal.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        <div><Label htmlFor="email">Adresse email</Label><Input id="email" type="email" value={email} onChange={e => autoFill(e.target.value)} placeholder="vous@example.com" required /></div>
        <div><Label htmlFor="display">Nom affiché (optionnel)</Label><Input id="display" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Votre nom" /></div>
        <div><Label htmlFor="pass">Mot de passe d'application</Label><Input id="pass" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="col-span-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Réception (IMAP)</div>
          <div className="col-span-2"><Label>Serveur IMAP</Label><Input value={imapHost} onChange={e => setImapHost(e.target.value)} placeholder="imap.example.com" required /></div>
          <div><Label>Port</Label><Input type="number" value={imapPort} onChange={e => setImapPort(parseInt(e.target.value) || 993)} /></div>
          <div className="flex items-center gap-2 pt-5"><Switch checked={imapSecure} onCheckedChange={setImapSecure} id="imap-tls" /><Label htmlFor="imap-tls" className="cursor-pointer">SSL/TLS</Label></div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          <div className="col-span-2 text-xs font-semibold uppercase text-muted-foreground tracking-wider">Envoi (SMTP)</div>
          <div className="col-span-2"><Label>Serveur SMTP</Label><Input value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com" required /></div>
          <div><Label>Port</Label><Input type="number" value={smtpPort} onChange={e => setSmtpPort(parseInt(e.target.value) || 587)} /></div>
          <div className="flex items-center gap-2 pt-5"><Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} id="smtp-tls" /><Label htmlFor="smtp-tls" className="cursor-pointer">SSL/TLS</Label></div>
        </div>
      </div>
      <div className="px-6 py-3 border-t border-border flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button type="submit"><Check className="w-4 h-4 mr-1.5" /> Connecter</Button>
      </div>
    </form>
  );
}

/* ─── ComposeView ─── */

function ComposeView({
  account, replyTo, onCancel, onSent,
}: { account: EmailAccount; replyTo: EmailMessage | null; onCancel: () => void; onSent: () => void }) {
  const [to, setTo] = useState(replyTo?.from_address || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject?.replace(/^Re:\s*/i, '') || ''}` : '');
  const [body, setBody] = useState(
    replyTo
      ? `\n\n---\nLe ${new Date(replyTo.received_at).toLocaleString('fr-FR')}, ${replyTo.from_address} a écrit :\n${(replyTo.body_text || '').split('\n').map(l => `> ${l}`).join('\n')}`
      : ''
  );
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);

  const handleSend = async () => {
    if (!to || !subject) { toast.error('Destinataire et sujet requis'); return; }
    setSending(true);
    try {
      await sendEmail({ account_id: account.id, to: to.split(',').map(s => s.trim()).filter(Boolean), cc: cc ? cc.split(',').map(s => s.trim()).filter(Boolean) : undefined, subject, body, in_reply_to: replyTo?.external_id });
      onSent();
    } catch (e: any) { toast.error(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex-1">
          {replyTo ? 'Répondre' : 'Nouveau message'}
        </h3>
        <span className="text-xs text-muted-foreground hidden sm:block">depuis {account.email_address}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}><X className="w-4 h-4" /></Button>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* To */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground w-8 shrink-0">À</span>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="destinataire@example.com"
            className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <button onClick={() => setShowCc(v => !v)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cc</button>
        </div>

        {/* Cc */}
        {showCc && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <span className="text-xs text-muted-foreground w-8 shrink-0">Cc</span>
            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="copie@example.com"
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <span className="text-xs text-muted-foreground w-8 shrink-0">Objet</span>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Sujet de l'email"
            className="flex-1 text-sm bg-transparent outline-none text-foreground font-medium placeholder:text-muted-foreground placeholder:font-normal"
          />
        </div>

        {/* Body */}
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Écrivez votre message ici…"
          className="flex-1 resize-none border-0 rounded-none shadow-none focus-visible:ring-0 font-sans text-sm px-4 py-3 min-h-[200px]"
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={handleSend} disabled={sending || !to || !subject}>
          {sending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
          Envoyer
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Annuler</Button>
      </div>
    </div>
  );
}

/* ─── ProviderChooser ─── */

function ProviderChooser({
  onPickGmail, onPickImap, onCancel, embedded,
}: { onPickGmail: () => void; onPickImap: () => void; onCancel?: () => void; embedded?: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            {embedded ? 'Ajouter un compte email' : 'Connecter une boîte mail'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Choisissez votre fournisseur. Vous pouvez ajouter plusieurs comptes.</p>
        </div>
        {onCancel && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCancel}><X className="w-4 h-4" /></Button>}
      </div>
      <div className="flex-1 overflow-y-auto p-6 grid sm:grid-cols-2 gap-3 content-start">
        <button
          onClick={onPickGmail}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
        >
          <img src={gmailLogo} alt="Gmail" className="w-10 h-10" />
          <div>
            <h3 className="font-semibold text-sm">Gmail</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Connexion sécurisée via Google. Pas de mot de passe à saisir.</p>
          </div>
          <span className="mt-auto text-xs text-primary font-medium group-hover:underline">Se connecter avec Google →</span>
        </button>
        <button
          onClick={onPickImap}
          className="group flex flex-col items-start gap-3 p-5 rounded-xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Autre (IMAP/SMTP)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Yahoo, Outlook, OVH, ProtonMail, hébergement perso…</p>
          </div>
          <span className="mt-auto text-xs text-primary font-medium group-hover:underline">Configurer manuellement →</span>
        </button>
      </div>
    </div>
  );
}
