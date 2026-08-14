import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Info, Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/context/OrgContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

const RECAL_MIN_PROJECTS = 3;
const DEVIATION_ALERT = 15;

export default function SummaryTab() {
  const { myRole, isSuperAdmin } = useOrg();
  const invalidate = useInvalidateTime();
  const { data: entries = [], isLoading: entriesLoading } = useTimeEntries();
  const { data: lots = [], isLoading: lotsLoading } = useTimeLots();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = isSuperAdmin || myRole === 'admin' || myRole === 'owner';

  const rows = useMemo(() => {
    return lots
      .map((lot) => {
        const lotEntries = entries.filter((e) => e.lotId === lot.id);
        if (lotEntries.length === 0) return null;
        const projectKeys = new Set(lotEntries.map((e) => e.projectId ?? '__none__'));
        const totalHours = lotEntries.reduce((s, e) => s + e.seconds, 0) / 3600;
        const projectCount = projectKeys.size;
        const avgHours = projectCount > 0 ? totalHours / projectCount : 0;
        const deviation = lot.targetHours > 0 ? ((avgHours - lot.targetHours) / lot.targetHours) * 100 : 0;
        return { lot, projectCount, totalHours, avgHours, deviation };
      })
      .filter(Boolean) as {
        lot: (typeof lots)[number];
        projectCount: number;
        totalHours: number;
        avgHours: number;
        deviation: number;
      }[];
  }, [lots, entries]);

  const recalCandidates = rows.filter(
    (r) => r.projectCount >= RECAL_MIN_PROJECTS && Math.abs(r.avgHours - r.lot.targetHours) > 0.01,
  );

  const applyRecal = async () => {
    setSaving(true);
    for (const r of recalCandidates) {
      const { error } = await supabase
        .from('time_lots')
        .update({ target_hours: Number(r.avgHours.toFixed(2)) })
        .eq('id', r.lot.id);
      if (error) {
        setSaving(false);
        setConfirmOpen(false);
        return toast.error(`Recalage impossible : ${error.message}`);
      }
    }
    setSaving(false);
    setConfirmOpen(false);
    invalidate();
    toast.success(`${recalCandidates.length} temps cible(s) recalé(s)`);
  };

  if (entriesLoading || lotsLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium text-foreground">Aucun temps mesuré pour l’instant</p>
        <p className="text-xs text-muted-foreground mt-1">
          Enregistrez au moins un relevé depuis l’onglet « Chronomètre » : la synthèse comparera alors
          le temps réel de chaque lot à sa cible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Moyenne réelle par projet comparée au temps cible de chaque lot.
        </p>
        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={recalCandidates.length === 0}
          >
            <Wand2 className="w-4 h-4 mr-1.5" /> Recaler les temps cibles
          </Button>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 flex gap-2">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Le recalage ne porte que sur les lots mesurés sur au moins {RECAL_MIN_PROJECTS} projets
            distincts : en dessous de ce seuil, une moyenne n’a aucune valeur statistique et
            reproduirait le hasard d’un ou deux chantiers atypiques.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Lot</th>
              <th className="px-3 py-2 font-medium text-right">Projets</th>
              <th className="px-3 py-2 font-medium text-right">Total (h)</th>
              <th className="px-3 py-2 font-medium text-right">Moyenne / projet</th>
              <th className="px-3 py-2 font-medium text-right">Cible (h)</th>
              <th className="px-3 py-2 font-medium text-right">Écart</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const alert = Math.abs(r.deviation) > DEVIATION_ALERT;
              return (
                <tr key={r.lot.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.lot.code}</span>{' '}
                    <span className="text-muted-foreground">{r.lot.label}</span>
                  </td>
                  <td data-numeric className="font-numeric tabular-nums px-3 py-2 text-right">{r.projectCount}</td>
                  <td data-numeric className="font-numeric tabular-nums px-3 py-2 text-right">{formatHoursFr(r.totalHours)}</td>
                  <td data-numeric className="font-numeric tabular-nums px-3 py-2 text-right">{formatHoursFr(r.avgHours)}</td>
                  <td data-numeric className="font-numeric tabular-nums px-3 py-2 text-right">{formatHoursFr(r.lot.targetHours, 0)}</td>
                  <td
                    data-numeric
                    className={`font-numeric tabular-nums px-3 py-2 text-right font-medium ${
                      alert ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {r.lot.targetHours > 0
                      ? `${r.deviation > 0 ? '+' : ''}${Math.round(r.deviation)} %`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-popover text-popover-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Recaler les temps cibles ?</AlertDialogTitle>
            <AlertDialogDescription>
              Seuls les lots mesurés sur au moins {RECAL_MIN_PROJECTS} projets sont concernés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto text-sm space-y-1.5">
            {recalCandidates.map((r) => (
              <div key={r.lot.id} className="flex items-center justify-between gap-3">
                <span className="truncate">
                  <span className="font-medium">{r.lot.code}</span>{' '}
                  <span className="text-muted-foreground">{r.lot.label}</span>
                </span>
                <span data-numeric className="font-numeric tabular-nums whitespace-nowrap">
                  {formatHoursFr(r.lot.targetHours, 0)} h → {formatHoursFr(r.avgHours)} h
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={applyRecal} disabled={saving}>
              Valider le recalage
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
