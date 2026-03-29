import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Trash2, CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import type { CalendarAccount } from '@/hooks/useCalendarSync';

const PROVIDER_META: Record<string, { label: string; icon: string; color: string; dot: string }> = {
  google: { label: 'Google Calendar', icon: '📅', color: 'text-red-500', dot: 'bg-[#EA4335]' },
  
  caldav: { label: 'CalDAV', icon: '🔗', color: 'text-purple-500', dot: 'bg-[#8B5CF6]' },
  icloud: { label: 'Apple iCal', icon: '🍎', color: 'text-gray-600', dot: 'bg-[#8B5CF6]' },
  nextcloud: { label: 'Nextcloud', icon: '☁️', color: 'text-blue-500', dot: 'bg-[#8B5CF6]' },
  proton: { label: 'Proton Calendar', icon: '🔒', color: 'text-purple-500', dot: 'bg-[#8B5CF6]' },
  fastmail: { label: 'Fastmail', icon: '✉️', color: 'text-purple-500', dot: 'bg-[#8B5CF6]' },
  ics: { label: 'Agenda ICS', icon: '📄', color: 'text-muted-foreground', dot: 'bg-[#6B7280]' },
};

export function getProviderMeta(provider: string) {
  return PROVIDER_META[provider] || PROVIDER_META.caldav;
}

function isReadOnly(provider: string) {
  return provider === 'ics';
}

const CALDAV_HINTS: Record<string, { url: string; hint: string }> = {
  icloud: { url: 'https://caldav.icloud.com/', hint: 'Utilise un mot de passe d\'application Apple' },
  nextcloud: { url: 'https://ton-serveur.com/remote.php/dav/calendars/USER/', hint: 'Remplace USER par ton identifiant' },
  proton: { url: 'https://calendar.proton.me/dav/calendars/', hint: 'Active CalDAV dans les paramètres Proton' },
  fastmail: { url: 'https://caldav.fastmail.com/dav/calendars/', hint: 'Utilise un mot de passe d\'application Fastmail' },
  caldav: { url: '', hint: 'Entre l\'URL CalDAV de ton serveur' },
};

interface Props {
  accounts: CalendarAccount[];
  syncing: string | null;
  visibleAccountIds: Set<string>;
  onToggleVisibility: (accountId: string) => void;
  onSetAllVisible: (visible: boolean) => void;
  onSync: (accountId: string) => void;
  onDelete: (accountId: string) => void;
  onAddCalDav: (label: string, url: string, user: string, pass: string, provider: string) => Promise<any>;
  onAddIcs: (label: string, url: string) => Promise<any>;
  onTestConnection: (accountId: string) => Promise<boolean>;
}

type ModalStep = 'picker' | 'icloud' | 'caldav' | 'ics';

export default function CalendarAccountsManager({ accounts, syncing, visibleAccountIds, onToggleVisibility, onSetAllVisible, onSync, onDelete, onAddCalDav, onAddIcs, onTestConnection }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>('picker');
  const [accountsOpen, setAccountsOpen] = useState(false);

  // CalDAV / iCloud form
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

  const handleConnectGoogle = async () => {
    const { data: { user } } = await (await import('@/integrations/supabase/client')).supabase.auth.getUser();
    const userId = user?.id || '';
    window.location.href = `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/google-oauth/authorize?user_id=${userId}`;
  };


  const handleStartIcloud = () => {
    setCaldavProvider('icloud');
    setCaldavLabel('Apple iCal');
    setCaldavUrl('https://caldav.icloud.com/');
    setCaldavUser('');
    setCaldavPass('');
    setStep('icloud');
  };

  const handleSelectCaldavProvider = (p: string) => {
    setCaldavProvider(p);
    const hint = CALDAV_HINTS[p];
    if (hint?.url) setCaldavUrl(hint.url);
    else setCaldavUrl('');
  };

  const handleTestCalDav = async () => {
    setTesting(true); setTestResult(null);
    const acc = await onAddCalDav(caldavLabel || caldavProvider, caldavUrl, caldavUser, caldavPass, caldavProvider);
    if (acc) {
      const ok = await onTestConnection(acc.id);
      setTestResult(ok);
      if (!ok) onDelete(acc.id);
    }
    setTesting(false);
  };

  const handleSubmitCalDav = async () => {
    setSubmitting(true);
    if (!testResult) {
      await onAddCalDav(caldavLabel || caldavProvider, caldavUrl, caldavUser, caldavPass, caldavProvider);
    }
    setOpen(false); resetForms();
  };

  const handleSubmitIcs = async () => {
    setSubmitting(true);
    await onAddIcs(icsLabel || 'Agenda ICS', icsUrl);
    setOpen(false); resetForms();
  };

  const formatLastSync = (date: string | null) => {
    if (!date) return null;
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'à l\'instant';
    if (mins < 60) return `il y a ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `il y a ${hrs}h`;
    return `il y a ${Math.floor(hrs / 24)}j`;
  };

  const stepTitle = step === 'picker' ? 'Connecter un agenda'
    : step === 'icloud' ? 'Connexion Apple iCal (iCloud)'
    : step === 'caldav' ? 'Connexion CalDAV'
    : 'Agenda ICS (lecture seule)';

  return (
    <div className="space-y-3">
      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <Collapsible open={accountsOpen} onOpenChange={setAccountsOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 w-full px-1 py-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors">
              <ChevronDown className={`w-4 h-4 transition-transform ${accountsOpen ? '' : '-rotate-90'}`} />
              Agendas connectés
              <span className="text-xs text-muted-foreground">({visibleAccountIds.size}/{accounts.length})</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="flex justify-end mb-1 mt-1">
              <button
                onClick={() => onSetAllVisible(visibleAccountIds.size < accounts.length)}
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors px-1"
              >
                {visibleAccountIds.size === accounts.length ? 'Tout désélectionner' : 'Tout sélectionner'}
              </button>
            </div>
            <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
              <div className="space-y-1 pr-1">
                {accounts.map(acc => {
                  const meta = getProviderMeta(acc.provider);
                  const isSyncing = syncing === acc.id;
                  const isVisible = visibleAccountIds.has(acc.id);
                  const lastSync = formatLastSync(acc.last_synced_at);
                  return (
                    <div key={acc.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${isVisible ? 'bg-muted/40 border-border' : 'bg-muted/10 border-transparent opacity-60'}`}>
                      <Checkbox
                        checked={isVisible}
                        onCheckedChange={() => onToggleVisibility(acc.id)}
                        className="shrink-0"
                      />
                      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block">
                          {acc.label || meta.label}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {lastSync && <span className="text-[10px] text-muted-foreground">Sync {lastSync}</span>}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                            {isReadOnly(acc.provider) ? 'Lecture seule' : 'Bidirectionnel'}
                          </Badge>
                        </div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onSync(acc.id)} disabled={isSyncing}>
                            {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Synchroniser</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(acc.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Déconnecter</TooltipContent>
                      </Tooltip>
                    </div>
                  );
                })}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Add button + modal */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForms(); }}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-foreground">
            <Plus className="w-3.5 h-3.5" />
            Connecter un agenda
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{stepTitle}</DialogTitle>
          </DialogHeader>

          {step === 'picker' && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {/* Google */}
              <button onClick={handleConnectGoogle}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all text-center group">
                <span className="text-3xl">📅</span>
                <span className="text-sm font-semibold text-foreground">Google Calendar</span>
                <span className="text-[11px] text-muted-foreground">OAuth sécurisé</span>
                <Badge variant="secondary" className="text-[10px] mt-1">Bidirectionnel</Badge>
              </button>

              {/* Apple iCal */}
              <button onClick={handleStartIcloud}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-950/20 transition-all text-center group">
                <span className="text-3xl">🍎</span>
                <span className="text-sm font-semibold text-foreground">Apple iCal</span>
                <span className="text-[11px] text-muted-foreground">iCloud CalDAV</span>
                <Badge variant="secondary" className="text-[10px] mt-1">Bidirectionnel</Badge>
              </button>

              {/* CalDAV */}
              <button onClick={() => setStep('caldav')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all text-center group">
                <span className="text-3xl">🔗</span>
                <span className="text-sm font-semibold text-foreground">CalDAV</span>
                <span className="text-[11px] text-muted-foreground">Nextcloud · Proton · Fastmail</span>
                <Badge variant="secondary" className="text-[10px] mt-1">Bidirectionnel</Badge>
              </button>

              {/* ICS */}
              <button onClick={() => setStep('ics')}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border hover:border-foreground/40 hover:bg-muted transition-all text-center col-span-2 group">
                <span className="text-3xl">📄</span>
                <span className="text-sm font-semibold text-foreground">Agenda ICS</span>
                <span className="text-[11px] text-muted-foreground">Tout calendrier public</span>
                <Badge variant="outline" className="text-[10px] mt-1">Lecture seule</Badge>
              </button>
            </div>
          )}

          {step === 'icloud' && (
            <div className="space-y-4 mt-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">📋 Comment se connecter à iCloud :</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Va sur <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">appleid.apple.com</a></li>
                  <li>Connecte-toi → <strong>Sécurité</strong> → <strong>Mots de passe d'application</strong></li>
                  <li>Crée un mot de passe pour « Euthymia Calendar »</li>
                  <li>Utilise ton <strong>identifiant Apple</strong> (email) et ce <strong>mot de passe d'application</strong> ci-dessous</li>
                </ol>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor="icloud-label">Nom (optionnel)</Label>
                  <Input id="icloud-label" value={caldavLabel} onChange={e => setCaldavLabel(e.target.value)} placeholder="Mon calendrier Apple" />
                </div>
                <div>
                  <Label htmlFor="icloud-url">URL CalDAV iCloud</Label>
                  <Input id="icloud-url" value={caldavUrl} onChange={e => setCaldavUrl(e.target.value)} placeholder="https://caldav.icloud.com/" />
                  <p className="text-[11px] text-muted-foreground mt-1">L'URL par défaut fonctionne pour la plupart des comptes</p>
                </div>
                <div>
                  <Label htmlFor="icloud-user">Identifiant Apple (email)</Label>
                  <Input id="icloud-user" type="email" value={caldavUser} onChange={e => setCaldavUser(e.target.value)} placeholder="prenom@icloud.com" />
                </div>
                <div>
                  <Label htmlFor="icloud-pass">Mot de passe d'application</Label>
                  <Input id="icloud-pass" type="password" value={caldavPass} onChange={e => setCaldavPass(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTestCalDav} disabled={testing || !caldavUrl || !caldavUser || !caldavPass} className="gap-1.5">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Tester la connexion
                </Button>
                {testResult === true && <span className="text-xs text-green-600 font-medium">✓ Connecté</span>}
                {testResult === false && <span className="text-xs text-destructive font-medium">✗ Échec — vérifie le mot de passe d'application</span>}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => resetForms()}>Annuler</Button>
                <Button onClick={handleSubmitCalDav} disabled={submitting || !caldavUrl || !caldavUser || !caldavPass}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Connecter
                </Button>
              </div>
            </div>
          )}

          {step === 'caldav' && (
            <div className="space-y-4 mt-2">
              <div className="flex gap-2 flex-wrap">
                {(['nextcloud', 'proton', 'fastmail', 'caldav'] as const).map(p => (
                  <button key={p} onClick={() => handleSelectCaldavProvider(p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${caldavProvider === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {p === 'caldav' ? 'Autre' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>

              {CALDAV_HINTS[caldavProvider]?.hint && (
                <p className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
                  💡 {CALDAV_HINTS[caldavProvider].hint}
                </p>
              )}

              <div className="space-y-2">
                <div>
                  <Label htmlFor="caldav-label">Nom (optionnel)</Label>
                  <Input id="caldav-label" value={caldavLabel} onChange={e => setCaldavLabel(e.target.value)} placeholder="Mon calendrier" />
                </div>
                <div>
                  <Label htmlFor="caldav-url">URL CalDAV</Label>
                  <Input id="caldav-url" value={caldavUrl} onChange={e => setCaldavUrl(e.target.value)} placeholder={CALDAV_HINTS[caldavProvider]?.url || "https://caldav.example.com/..."} />
                </div>
                <div>
                  <Label htmlFor="caldav-user">Nom d'utilisateur</Label>
                  <Input id="caldav-user" value={caldavUser} onChange={e => setCaldavUser(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="caldav-pass">Mot de passe</Label>
                  <Input id="caldav-pass" type="password" value={caldavPass} onChange={e => setCaldavPass(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleTestCalDav} disabled={testing || !caldavUrl || !caldavUser || !caldavPass} className="gap-1.5">
                  {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Tester la connexion
                </Button>
                {testResult === true && <span className="text-xs text-green-600 font-medium">✓ Connecté</span>}
                {testResult === false && <span className="text-xs text-destructive font-medium">✗ Échec — vérifie les identifiants</span>}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => resetForms()}>Annuler</Button>
                <Button onClick={handleSubmitCalDav} disabled={submitting || !caldavUrl || !caldavUser || !caldavPass}>
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  Connecter
                </Button>
              </div>
            </div>
          )}

          {step === 'ics' && (
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <div>
                  <Label htmlFor="ics-label">Nom (optionnel)</Label>
                  <Input id="ics-label" value={icsLabel} onChange={e => setIcsLabel(e.target.value)} placeholder="Agenda partagé" />
                </div>
                <div>
                  <Label htmlFor="ics-url">URL du fichier .ics</Label>
                  <Input id="ics-url" value={icsUrl} onChange={e => setIcsUrl(e.target.value)} placeholder="https://example.com/calendar.ics" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">⚠️ Les agendas ICS sont en lecture seule — les événements ne seront pas synchronisés en retour.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => resetForms()}>Annuler</Button>
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
