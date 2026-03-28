import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, RefreshCw, Trash2, ExternalLink, CheckCircle2, Loader2, Calendar as CalIcon, ChevronDown, Eye, EyeOff } from 'lucide-react';
import type { CalendarAccount } from '@/hooks/useCalendarSync';

const PROVIDER_META: Record<string, { label: string; icon: string; color: string; dot: string }> = {
  google: { label: 'Google Calendar', icon: '📅', color: 'text-red-500', dot: 'bg-red-500' },
  outlook: { label: 'Microsoft Outlook', icon: '📧', color: 'text-blue-600', dot: 'bg-blue-500' },
  caldav: { label: 'CalDAV', icon: '🔗', color: 'text-purple-500', dot: 'bg-purple-500' },
  icloud: { label: 'iCloud', icon: '☁️', color: 'text-purple-500', dot: 'bg-purple-500' },
  nextcloud: { label: 'Nextcloud', icon: '☁️', color: 'text-purple-500', dot: 'bg-purple-500' },
  proton: { label: 'Proton', icon: '🔒', color: 'text-purple-500', dot: 'bg-purple-500' },
  fastmail: { label: 'Fastmail', icon: '✉️', color: 'text-purple-500', dot: 'bg-purple-500' },
  ics: { label: 'Agenda ICS', icon: '📄', color: 'text-foreground', dot: 'bg-foreground' },
};

export function getProviderMeta(provider: string) {
  return PROVIDER_META[provider] || PROVIDER_META.caldav;
}

interface Props {
  accounts: CalendarAccount[];
  syncing: string | null;
  visibleAccountIds: Set<string>;
  onToggleVisibility: (accountId: string) => void;
  onSync: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onAddCalDav: (label: string, url: string, user: string, pass: string, provider: string) => Promise<any>;
  onAddIcs: (label: string, url: string) => Promise<any>;
  onTestConnection: (accountId: string) => Promise<boolean>;
}

type ModalStep = 'picker' | 'caldav' | 'ics';

export default function CalendarAccountsManager({ accounts, syncing, onSync, onDelete, onAddCalDav, onAddIcs, onTestConnection }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('picker');
  const [accountsOpen, setAccountsOpen] = useState(true);

  // CalDAV form
  const [caldavProvider, setCaldavProvider] = useState('caldav');
  const [caldavLabel, setCaldavLabel] = useState('');
  const [caldavUrl, setCaldavUrl] = useState('');
  const [caldavUser, setCaldavUser] = useState('');
  const [caldavPass, setCaldavPass] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  // ICS form
  const [icsLabel, setIcsLabel] = useState('');
  const [icsUrl, setIcsUrl] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const resetForms = () => {
    setStep('picker');
    setCaldavLabel(''); setCaldavUrl(''); setCaldavUser(''); setCaldavPass(''); setCaldavProvider('caldav');
    setIcsLabel(''); setIcsUrl('');
    setTesting(false); setTestResult(null); setSubmitting(false);
  };

  const handleConnectGoogle = () => {
    window.location.href = 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-oauth/authorize';
  };

  const handleConnectOutlook = () => {
    // Placeholder — same pattern as Google
    window.open(
      'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-oauth/authorize',
      '_blank'
    );
    setOpen(false);
    resetForms();
  };

  const handleTestCalDav = async () => {
    setTesting(true); setTestResult(null);
    // Save temp account then test
    const acc = await onAddCalDav(caldavLabel || caldavProvider, caldavUrl, caldavUser, caldavPass, caldavProvider);
    if (acc) {
      const ok = await onTestConnection(acc.id);
      setTestResult(ok);
      if (!ok) {
        // Remove failed account
        onDelete(acc.id);
      }
    }
    setTesting(false);
  };

  const handleSubmitCalDav = async () => {
    setSubmitting(true);
    if (!testResult) {
      // If not yet tested, add directly
      await onAddCalDav(caldavLabel || caldavProvider, caldavUrl, caldavUser, caldavPass, caldavProvider);
    }
    setOpen(false); resetForms();
  };

  const handleSubmitIcs = async () => {
    setSubmitting(true);
    await onAddIcs(icsLabel || 'Agenda ICS', icsUrl);
    setOpen(false); resetForms();
  };

  return (
    <div className="space-y-3">
      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full px-1 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${accountsOpen ? '' : '-rotate-90'}`} />
              Agendas connectés
              <span className="text-xs text-muted-foreground">({accounts.length})</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 mt-1">
              {accounts.map(acc => {
                const meta = getProviderMeta(acc.provider);
                const isSyncing = syncing === acc.id;
                return (
                  <div key={acc.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    <span className="text-sm font-medium text-foreground flex-1 truncate">
                      {acc.label || meta.label}
                    </span>
                    {acc.last_synced_at && (
                      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:block">
                        Sync : {new Date(acc.last_synced_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onSync(acc.id)} disabled={isSyncing}>
                          {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Synchroniser</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(acc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Déconnecter</TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Add button + modal */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForms(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Connecter un agenda
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{step === 'picker' ? 'Ajouter un agenda' : step === 'caldav' ? 'Connexion CalDAV' : 'Agenda ICS'}</DialogTitle>
          </DialogHeader>

          {step === 'picker' && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {/* Google */}
              <button onClick={handleConnectGoogle}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-center">
                <span className="text-3xl">📅</span>
                <span className="text-sm font-semibold text-foreground">Google Calendar</span>
                <span className="text-[11px] text-muted-foreground">OAuth sécurisé</span>
              </button>

              {/* Outlook */}
              <button onClick={handleConnectOutlook}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all text-center">
                <span className="text-3xl">📧</span>
                <span className="text-sm font-semibold text-foreground">Microsoft Outlook</span>
                <span className="text-[11px] text-muted-foreground">OAuth sécurisé</span>
              </button>

              {/* CalDAV */}
              <button onClick={() => setStep('caldav')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all text-center">
                <span className="text-3xl">🔗</span>
                <span className="text-sm font-semibold text-foreground">CalDAV</span>
                <span className="text-[11px] text-muted-foreground">iCloud · Nextcloud · Proton · Fastmail</span>
              </button>

              {/* ICS */}
              <button onClick={() => setStep('ics')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-foreground/40 hover:bg-muted transition-all text-center">
                <span className="text-3xl">📄</span>
                <span className="text-sm font-semibold text-foreground">Agenda ICS</span>
                <span className="text-[11px] text-muted-foreground">Lecture seule · URL .ics</span>
              </button>
            </div>
          )}

          {step === 'caldav' && (
            <div className="space-y-4 mt-2">
              <div className="flex gap-2">
                {['caldav', 'icloud', 'nextcloud', 'proton', 'fastmail'].map(p => (
                  <button key={p} onClick={() => setCaldavProvider(p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${caldavProvider === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {p === 'caldav' ? 'Autre' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <div><Label htmlFor="caldav-label">Nom (optionnel)</Label><Input id="caldav-label" value={caldavLabel} onChange={e => setCaldavLabel(e.target.value)} placeholder="Mon calendrier" /></div>
                <div><Label htmlFor="caldav-url">URL CalDAV</Label><Input id="caldav-url" value={caldavUrl} onChange={e => setCaldavUrl(e.target.value)} placeholder="https://caldav.example.com/..." /></div>
                <div><Label htmlFor="caldav-user">Nom d'utilisateur</Label><Input id="caldav-user" value={caldavUser} onChange={e => setCaldavUser(e.target.value)} /></div>
                <div><Label htmlFor="caldav-pass">Mot de passe</Label><Input id="caldav-pass" type="password" value={caldavPass} onChange={e => setCaldavPass(e.target.value)} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTestCalDav} disabled={testing || !caldavUrl} className="gap-1.5">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Tester la connexion
                </Button>
                {testResult === true && <span className="text-xs text-green-600 font-medium">✓ Connecté</span>}
                {testResult === false && <span className="text-xs text-destructive font-medium">✗ Échec</span>}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { resetForms(); }}>Annuler</Button>
                <Button onClick={handleSubmitCalDav} disabled={submitting || !caldavUrl}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Connecter
                </Button>
              </div>
            </div>
          )}

          {step === 'ics' && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <div><Label htmlFor="ics-label">Nom (optionnel)</Label><Input id="ics-label" value={icsLabel} onChange={e => setIcsLabel(e.target.value)} placeholder="Agenda partagé" /></div>
                <div><Label htmlFor="ics-url">URL du fichier .ics</Label><Input id="ics-url" value={icsUrl} onChange={e => setIcsUrl(e.target.value)} placeholder="https://example.com/calendar.ics" /></div>
              </div>
              <p className="text-xs text-muted-foreground">⚠️ Les agendas ICS sont en lecture seule — les événements ne seront pas synchronisés en retour.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => { resetForms(); }}>Annuler</Button>
                <Button onClick={handleSubmitIcs} disabled={submitting || !icsUrl}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Ajouter
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
