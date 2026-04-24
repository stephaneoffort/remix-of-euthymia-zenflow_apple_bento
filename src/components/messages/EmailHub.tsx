import { useEffect, useState } from 'react';
import {
  Mail, Plus, Trash2, RefreshCw, Send, Reply, Inbox, AlertCircle, X, Check, Loader2,
  History, ChevronDown, ChevronUp,
} from 'lucide-react';
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
    if (!confirm('Supprimer cet email ?')) return;
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

  if (view === 'detail' && selectedMessage && account) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setView('list'); setSelectedMessage(null); }}>
            ← Retour
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => { setReplyTo(selectedMessage); setView('compose'); }}>
            <Reply className="w-4 h-4 mr-1.5" />
            Répondre
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(selectedMessage)} className="text-destructive">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <h2 className="text-xl font-semibold mb-2">{selectedMessage.subject || '(sans objet)'}</h2>
          <div className="text-sm text-muted-foreground mb-4">
            <p>De : <span className="text-foreground">{selectedMessage.from_name || selectedMessage.from_address} &lt;{selectedMessage.from_address}&gt;</span></p>
            <p>À : <span className="text-foreground">{selectedMessage.to_addresses.join(', ')}</span></p>
            <p>Le {new Date(selectedMessage.received_at).toLocaleString('fr-FR')}</p>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {selectedMessage.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: selectedMessage.body_html }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans">{selectedMessage.body_text}</pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Account picker + actions */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <select
          value={selectedAccountId || ''}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          className="text-sm bg-background border border-border rounded-md px-2 py-1.5 outline-none focus:border-primary"
        >
          {accounts.map(a => (
            <option key={a.id} value={a.id}>
              {a.email_address} {a.unread_count > 0 ? `(${a.unread_count})` : ''}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncAccount.isPending}>
          {syncAccount.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setView('choose-provider')}>
          <Plus className="w-4 h-4 mr-1" /> Compte
        </Button>
        <div className="flex-1" />
        <Button size="sm" onClick={() => { setReplyTo(null); setView('compose'); }}>
          <Send className="w-4 h-4 mr-1.5" /> Nouveau
        </Button>
      </div>

      {account?.last_sync_error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {account.last_sync_error}
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        {loadingMessages && (
          <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>
        )}
        {!loadingMessages && messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun email</p>
            <Button variant="link" onClick={handleSync} className="mt-2">
              Synchroniser maintenant
            </Button>
          </div>
        )}
        {messages.map(msg => (
          <button
            key={msg.id}
            onClick={() => { setSelectedMessage(msg); setView('detail'); handleMarkRead(msg); }}
            className={`w-full text-left px-4 py-3 border-b border-border hover:bg-muted transition-colors ${
              !msg.is_read ? 'bg-primary/5' : ''
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold' : 'font-medium'}`}>
                {msg.from_name || msg.from_address}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(msg.received_at), { addSuffix: false, locale: fr })}
              </span>
            </div>
            <p className={`text-sm truncate ${!msg.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
              {msg.subject || '(sans objet)'}
            </p>
            {msg.preview && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.preview}</p>
            )}
          </button>
        ))}
      </div>
    </div>
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
