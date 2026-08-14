import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useOrg } from '@/context/OrgContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatHoursFr, useInvalidateTime, useTimeEntries, useTimeLots } from '@/hooks/useTimeTracking';

const ALL = '__all__';
const PAGE_SIZE = 50;

export default function EntriesTab() {
  const { projects, teamMembers } = useApp();
  const { teamMemberId } = useAuth();
  const { currentOrg, myRole, isSuperAdmin } = useOrg();
  const invalidate = useInvalidateTime();

  const { data: entries = [], isLoading } = useTimeEntries();
  const { data: lots = [] } = useTimeLots();

  const [projectFilter, setProjectFilter] = useState(ALL);
  const [lotFilter, setLotFilter] = useState(ALL);
  const [memberFilter, setMemberFilter] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const isAdmin = isSuperAdmin || myRole === 'admin' || myRole === 'owner';

  const lotById = useMemo(() => new Map(lots.map((l) => [l.id, l])), [lots]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const memberById = useMemo(() => new Map(teamMembers.map((m) => [m.id, m])), [teamMembers]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (projectFilter !== ALL && (e.projectId ?? '') !== projectFilter) return false;
      if (lotFilter !== ALL && (e.lotId ?? '') !== lotFilter) return false;
      if (memberFilter !== ALL && e.memberId !== memberFilter) return false;
      const day = e.startedAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [entries, projectFilter, lotFilter, memberFilter, from, to]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const header = 'date;membre;projet;lot;intitule;heures;note';
    const lines = filtered.map((e) => {
      const lot = e.lotId ? lotById.get(e.lotId) : null;
      const cells = [
        e.startedAt.slice(0, 10),
        memberById.get(e.memberId)?.name ?? e.memberId,
        e.projectId ? projectById.get(e.projectId)?.name ?? e.projectId : 'Sans projet',
        lot?.code ?? '',
        lot?.label ?? '',
        formatHoursFr(e.seconds / 3600),
        e.note ?? '',
      ];
      return cells.map((c) => String(c).replace(/[\r\n;]+/g, ' ')).join(';');
    });
    const blob = new Blob(['\uFEFF' + [header, ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temps-${currentOrg?.slug ?? 'equipe'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', toDelete);
    setToDelete(null);
    if (error) return toast.error(`Suppression impossible : ${error.message}`);
    invalidate();
    toast.success('Relevé supprimé');
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Projet</Label>
          <Select value={projectFilter} onValueChange={(v) => { setProjectFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les projets</SelectItem>
              {projects.filter((p) => !p.isArchived).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Lot</Label>
          <Select value={lotFilter} onValueChange={(v) => { setLotFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les lots</SelectItem>
              {lots.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.code} — {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Membre</Label>
          <Select value={memberFilter} onValueChange={(v) => { setMemberFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les membres</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Du</Label>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Au</Label>
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p data-numeric className="font-numeric tabular-nums text-xs text-muted-foreground">
          {filtered.length} relevé(s) · {formatHoursFr(filtered.reduce((s, e) => s + e.seconds, 0) / 3600)} h
        </p>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-1.5" /> Exporter en CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">Aucun relevé sur ces critères</p>
          <p className="text-xs text-muted-foreground mt-1">
            Lancez le chronomètre dans l’onglet « Chronomètre », ou élargissez les filtres de période.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Lot</th>
                <th className="px-3 py-2 font-medium">Projet</th>
                <th className="px-3 py-2 font-medium">Membre</th>
                <th className="px-3 py-2 font-medium text-right">Heures</th>
                <th className="px-3 py-2 font-medium">Note</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => {
                const lot = e.lotId ? lotById.get(e.lotId) : null;
                const canDelete = isAdmin || e.memberId === teamMemberId;
                return (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td data-numeric className="font-numeric tabular-nums px-3 py-2 whitespace-nowrap">
                      {new Date(e.startedAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{lot?.code ?? '—'}</span>
                      <span className="text-muted-foreground"> {lot?.label ?? ''}</span>
                    </td>
                    <td className="px-3 py-2">
                      {e.projectId ? projectById.get(e.projectId)?.name ?? '—' : 'Sans projet'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {memberById.get(e.memberId)?.name ?? '—'}
                    </td>
                    <td data-numeric className="font-numeric tabular-nums px-3 py-2 text-right whitespace-nowrap">
                      {formatHoursFr(e.seconds / 3600)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[240px] truncate">{e.note ?? ''}</td>
                    <td className="px-3 py-2 text-right">
                      {canDelete && (
                        <button
                          onClick={() => setToDelete(e.id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                          title="Supprimer ce relevé"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Précédent
          </Button>
          <span data-numeric className="font-numeric tabular-nums text-xs text-muted-foreground">
            Page {current + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent className="bg-popover text-popover-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce relevé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive : le temps enregistré sera retiré des cumuls et de la synthèse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
