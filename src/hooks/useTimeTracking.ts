import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useOrg } from '@/context/OrgContext';

export interface TimeLot {
  id: string;
  code: string;
  label: string;
  category: string;
  targetHours: number;
  sortOrder: number;
}

export interface TimeEntryRow {
  id: string;
  memberId: string;
  projectId: string | null;
  lotId: string | null;
  seconds: number;
  note: string | null;
  startedAt: string;
}

export interface ActiveTimerRow {
  id: string;
  memberId: string;
  orgId: string;
  projectId: string | null;
  lotId: string | null;
  accumulatedSeconds: number;
  isPaused: boolean;
  startedAt: string;
  note: string | null;
}

/** Lots actifs de l'équipe active, triés par ordre d'affichage. */
export function useTimeLots() {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ['time-lots', currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async (): Promise<TimeLot[]> => {
      const { data, error } = await supabase
        .from('time_lots')
        .select('id, code, label, category, target_hours, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((l) => ({
        id: l.id,
        code: l.code,
        label: l.label,
        category: l.category,
        targetHours: Number(l.target_hours),
        sortOrder: l.sort_order,
      }));
    },
  });
}

/** Tous les relevés de l'équipe active (le RLS filtre par organisation). */
export function useTimeEntries() {
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ['time-entries', currentOrg?.id],
    enabled: !!currentOrg,
    queryFn: async (): Promise<TimeEntryRow[]> => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, member_id, project_id, lot_id, seconds, note, started_at')
        .order('started_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []).map((e) => ({
        id: e.id,
        memberId: e.member_id,
        projectId: e.project_id,
        lotId: e.lot_id,
        seconds: e.seconds,
        note: e.note,
        startedAt: e.started_at,
      }));
    },
  });
}

/** Chronomètre en cours du membre courant, toutes équipes confondues. */
export function useActiveTimer() {
  const { teamMemberId } = useAuth();
  const { currentOrg } = useOrg();
  return useQuery({
    queryKey: ['time-active', teamMemberId, currentOrg?.id],
    enabled: !!teamMemberId,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<ActiveTimerRow | null> => {
      const { data, error } = await supabase
        .from('time_active')
        .select('id, member_id, org_id, project_id, lot_id, accumulated_seconds, is_paused, started_at, note')
        .eq('member_id', teamMemberId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        memberId: data.member_id,
        orgId: data.org_id,
        projectId: data.project_id,
        lotId: data.lot_id,
        accumulatedSeconds: data.accumulated_seconds,
        isPaused: data.is_paused,
        startedAt: data.started_at,
        note: data.note,
      };
    },
  });
}

/**
 * Secondes écoulées recalculées depuis la base : jamais un compteur client.
 * Le tick ne sert qu'au rafraîchissement de l'affichage.
 */
export function useElapsedSeconds(timer: ActiveTimerRow | null | undefined) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!timer || timer.isPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer?.id, timer?.isPaused, timer?.startedAt]);

  return useMemo(() => {
    if (!timer) return 0;
    const base = timer.accumulatedSeconds || 0;
    if (timer.isPaused) return base;
    const delta = Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000);
    return base + Math.max(0, delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, Math.floor(Date.now() / 1000)]);
}

export function formatHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatHoursFr(hours: number, digits = 2) {
  return hours.toFixed(digits).replace('.', ',');
}

/** Invalidation groupée après une écriture. */
export function useInvalidateTime() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ['time-active'] });
    qc.invalidateQueries({ queryKey: ['time-entries'] });
    qc.invalidateQueries({ queryKey: ['time-lots'] });
  }, [qc]);
}
