import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Play, Pause, Square, RotateCcw, Plus, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useOrg } from '@/context/OrgContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatHMS,
  formatHoursFr,
  useActiveTimer,
  useElapsedSeconds,
  useInvalidateTime,
  useTimeEntries,
  useTimeLots,
} from '@/hooks/useTimeTracking';

const NO_PROJECT = '__none__';

export default function TimerTab() {
  const { projects } = useApp();
  const { teamMemberId } = useAuth();
  const { currentOrg, myOrgs, switchOrg } = useOrg();
  const invalidate = useInvalidateTime();

  const { data: lots = [], isLoading: lotsLoading } = useTimeLots();
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries();
  const { data: activeTimer, isLoading: timerLoading } = useActiveTimer();

  const foreignTimer = !!activeTimer && !!currentOrg && activeTimer.orgId !== currentOrg.id;
  const localTimer = foreignTimer ? null : activeTimer ?? null;
  const elapsed = useElapsedSeconds(localTimer);

  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [lotId, setLotId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // La sélection suit le chronomètre restauré depuis la base
  const [synced, setSynced] = useState(false);
  if (!synced && localTimer) {
    setProjectId(localTimer.projectId ?? NO_PROJECT);
    setLotId(localTimer.lotId ?? '');
    setSynced(true);
  }

  const activeProjects = useMemo(
    () => projects.filter((p) => !p.isArchived).sort((a, b) => a.order - b.order),
    [projects],
  );

  const lotsByCategory = useMemo(() => {
    const map = new Map<string, typeof lots>();
    for (const lot of lots) {
      const list = map.get(lot.category) ?? [];
      list.push(lot);
      map.set(lot.category, list);
    }
    return Array.from(map.entries());
  }, [lots]);

  const selectedLot = lots.find((l) => l.id === lotId) ?? null;
  const effectiveProjectId = projectId === NO_PROJECT ? null : projectId;

  // Cumul de l'équipe pour ce couple (projet, lot), tous membres confondus
  const cumulSeconds = useMemo(() => {
    if (!selectedLot) return 0;
    return entries
      .filter((e) => e.lotId === selectedLot.id && (e.projectId ?? null) === effectiveProjectId)
      .reduce((sum, e) => sum + e.seconds, 0);
  }, [entries, selectedLot, effectiveProjectId]);

  const runningMatchesSelection =
    !!localTimer &&
    (localTimer.lotId ?? null) === (selectedLot?.id ?? null) &&
    (localTimer.projectId ?? null) === effectiveProjectId;

  const totalSeconds = cumulSeconds + (runningMatchesSelection ? elapsed : 0);
  const totalHours = totalSeconds / 3600;
  const targetHours = selectedLot?.targetHours ?? 0;
  const ratio = targetHours > 0 ? totalHours / targetHours : 0;
  const overrun = Math.max(0, totalHours - targetHours);

  const guard = () => {
    if (!teamMemberId || !currentOrg) {
      toast.error('Aucune équipe active');
      return false;
    }
    return true;
  };

  const start = async () => {
    if (!guard()) return;
    setBusy(true);
    const { error } = await supabase.from('time_active').upsert(
      {
        member_id: teamMemberId!,
        org_id: currentOrg!.id,
        project_id: effectiveProjectId,
        lot_id: selectedLot?.id ?? null,
        started_at: new Date().toISOString(),
        accumulated_seconds: 0,
        is_paused: false,
      },
      { onConflict: 'member_id' },
    );
    setBusy(false);
    if (error) return toast.error(`Démarrage impossible : ${error.message}`);
    invalidate();
  };

  const pause = async () => {
    if (!localTimer) return;
    setBusy(true);
    const delta = Math.floor((Date.now() - new Date(localTimer.startedAt).getTime()) / 1000);
    const { error } = await supabase
      .from('time_active')
      .update({
        accumulated_seconds: localTimer.accumulatedSeconds + Math.max(0, delta),
        is_paused: true,
      })
      .eq('id', localTimer.id);
    setBusy(false);
    if (error) return toast.error(`Mise en pause impossible : ${error.message}`);
    invalidate();
  };

  const resume = async () => {
    if (!localTimer) return;
    setBusy(true);
    const { error } = await supabase
      .from('time_active')
      .update({ started_at: new Date().toISOString(), is_paused: false })
      .eq('id', localTimer.id);
    setBusy(false);
    if (error) return toast.error(`Reprise impossible : ${error.message}`);
    invalidate();
  };

  const stop = async () => {
    if (!localTimer || !currentOrg) return;
    setBusy(true);
    const seconds = localTimer.isPaused
      ? localTimer.accumulatedSeconds
      : localTimer.accumulatedSeconds +
        Math.max(0, Math.floor((Date.now() - new Date(localTimer.startedAt).getTime()) / 1000));

    if (seconds < 5) {
      const { error } = await supabase.from('time_active').delete().eq('id', localTimer.id);
      setBusy(false);
      if (error) return toast.error(error.message);
      invalidate();
      toast.info('Session de moins de 5 secondes ignorée');
      return;
    }

    // Début réel de la session : fin moins durée totale
    const realStart = new Date(Date.now() - seconds * 1000).toISOString();
    const { error: insertError } = await supabase.from('time_entries').insert({
      member_id: localTimer.memberId,
      org_id: localTimer.orgId,
      project_id: localTimer.projectId,
      lot_id: localTimer.lotId,
      seconds,
      note: localTimer.note,
      started_at: realStart,
    });
    if (insertError) {
      setBusy(false);
      return toast.error(`Enregistrement impossible : ${insertError.message}`);
    }
    await supabase.from('time_active').delete().eq('id', localTimer.id);
    setBusy(false);
    invalidate();
    toast.success(`Relevé enregistré (${formatHoursFr(seconds / 3600)} h)`);
  };

  if (timerLoading || lotsLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  if (foreignTimer && activeTimer) {
    const orgName = myOrgs.find((o) => o.id === activeTimer.orgId)?.name ?? 'une autre équipe';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Un chronomètre est en cours sur l'équipe {orgName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Il reste actif et intact. Basculez sur cette équipe pour le poursuivre ou l'arrêter.
            </p>
          </div>
          <Button size="sm" onClick={() => switchOrg(activeTimer.orgId)} className="shrink-0">
            <ArrowRightLeft className="w-4 h-4 mr-1.5" />
            Basculer vers {orgName}
          </Button>
        </div>
      </div>
    );
  }

  const running = !!localTimer && !localTimer.isPaused;

  return (
    <div className="space-y-5">
      {/* Sélecteurs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Projet</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Sans projet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PROJECT}>Sans projet</SelectItem>
              {activeProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lot</Label>
          <Select value={lotId} onValueChange={setLotId}>
            <SelectTrigger>
              <SelectValue placeholder="Choisir un lot" />
            </SelectTrigger>
            <SelectContent>
              {lotsByCategory.map(([category, list]) => (
                <SelectGroup key={category}>
                  <SelectLabel>{category}</SelectLabel>
                  {list.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code} — {l.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Compteur */}
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <div
          data-numeric
          className={`font-numeric tabular-nums text-4xl sm:text-6xl font-semibold tracking-tight transition-colors ${
            running ? 'text-primary' : 'text-muted-foreground'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {formatHMS(localTimer ? elapsed : 0)}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {localTimer ? (running ? 'En cours' : 'En pause') : 'Aucun chronomètre en cours'}
        </p>

        {/* Barre de comparaison cumul / cible */}
        <div className="mt-5 text-left">
          {selectedLot ? (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1.5">
                <span className="text-xs text-muted-foreground">
                  {selectedLot.code} — {selectedLot.label}
                </span>
                <span
                  data-numeric
                  className="font-numeric tabular-nums text-xs font-medium text-foreground"
                >
                  cumul {formatHoursFr(totalHours)} h · cible {formatHoursFr(targetHours, 0)} h
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    ratio > 1 ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, ratio * 100)}%` }}
                />
              </div>
              <p
                className={`text-xs mt-1.5 ${ratio > 1 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
              >
                {targetHours <= 0
                  ? 'Aucune cible définie pour ce lot'
                  : ratio > 1
                    ? `Dépassement de ${formatHoursFr(overrun)} h (${Math.round(ratio * 100)} % de la cible)`
                    : `${Math.round(ratio * 100)} % de la cible consommée`}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Choisissez un lot pour suivre le cumul de l'équipe face à la cible.
            </p>
          )}
        </div>

        {/* Boutons */}
        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {!localTimer && (
            <Button onClick={start} disabled={busy}>
              <Play className="w-4 h-4 mr-1.5" /> Démarrer
            </Button>
          )}
          {localTimer && !localTimer.isPaused && (
            <Button variant="secondary" onClick={pause} disabled={busy}>
              <Pause className="w-4 h-4 mr-1.5" /> Pause
            </Button>
          )}
          {localTimer && localTimer.isPaused && (
            <Button variant="secondary" onClick={resume} disabled={busy}>
              <RotateCcw className="w-4 h-4 mr-1.5" /> Reprendre
            </Button>
          )}
          {localTimer && (
            <Button variant="default" onClick={stop} disabled={busy}>
              <Square className="w-4 h-4 mr-1.5" /> Arrêter et enregistrer
            </Button>
          )}
          {localTimer && (
            <Button variant="outline" onClick={start} disabled={busy}>
              <Play className="w-4 h-4 mr-1.5" /> Redémarrer sur la sélection
            </Button>
          )}
        </div>
      </div>

      <ManualEntryBlock
        projectId={effectiveProjectId}
        lotId={selectedLot?.id ?? null}
        entriesLoading={entriesLoading}
      />
    </div>
  );
}

function ManualEntryBlock({
  projectId,
  lotId,
  entriesLoading,
}: {
  projectId: string | null;
  lotId: string | null;
  entriesLoading: boolean;
}) {
  const { teamMemberId } = useAuth();
  const { currentOrg } = useOrg();
  const invalidate = useInvalidateTime();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const mins = parseInt(minutes, 10);
    if (!teamMemberId || !currentOrg) return toast.error('Aucune équipe active');
    if (!lotId) return toast.error('Choisissez un lot avant d’ajouter un temps');
    if (!Number.isFinite(mins) || mins <= 0) return toast.error('Durée en minutes invalide');
    setSaving(true);
    const { error } = await supabase.from('time_entries').insert({
      member_id: teamMemberId,
      org_id: currentOrg.id,
      project_id: projectId,
      lot_id: lotId,
      seconds: mins * 60,
      note: note.trim() || null,
      started_at: new Date(`${date}T12:00:00`).toISOString(),
    });
    setSaving(false);
    if (error) return toast.error(`Ajout impossible : ${error.message}`);
    setMinutes('');
    setNote('');
    invalidate();
    toast.success('Temps ajouté');
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Ajouter un temps déjà passé</h2>
        <p className="text-xs text-muted-foreground">
          Utilise le projet et le lot sélectionnés au-dessus.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Durée (minutes)</Label>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="90"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Note</Label>
          <Textarea
            rows={1}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optionnel"
            className="min-h-10"
          />
        </div>
      </div>
      <Button size="sm" onClick={submit} disabled={saving || entriesLoading}>
        <Plus className="w-4 h-4 mr-1.5" /> Ajouter le temps
      </Button>
    </div>
  );
}
