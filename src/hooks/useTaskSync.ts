import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CALENDAR_SYNC_URL = 'https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/calendar-sync';

async function callCalendarSync(body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const res = await fetch(CALENDAR_SYNC_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function getGoogleAccountId(): Promise<string | null> {
  const { data } = await supabase
    .from('calendar_accounts')
    .select('id')
    .eq('provider', 'google')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

export function useTaskSync() {
  const syncTask = useCallback(async (
    taskId: string,
    action: 'create' | 'update' | 'delete',
  ) => {
    const accountId = await getGoogleAccountId();
    if (!accountId) return; // No Google account connected — skip silently

    try {
      await callCalendarSync({
        account_id: accountId,
        direction: 'push_task',
        task_id: taskId,
        action,
      });
    } catch (err: any) {
      console.error('ZENFLOW sync failed:', err);
    }
  }, []);

  const initZenflowCalendar = useCallback(async () => {
    const accountId = await getGoogleAccountId();
    if (!accountId) return null;

    try {
      const result = await callCalendarSync({
        account_id: accountId,
        direction: 'init_zenflow_calendar',
      });
      return result?.calendar_id ?? null;
    } catch (err: any) {
      console.error('ZENFLOW init failed:', err);
      return null;
    }
  }, []);

  const syncAllPending = useCallback(async () => {
    const accountId = await getGoogleAccountId();
    if (!accountId) {
      toast.error("Aucun compte Google Calendar connecté.");
      return 0;
    }

    try {
      const result = await callCalendarSync({
        account_id: accountId,
        direction: 'sync_pending_tasks',
      });
      const count = result?.synced ?? 0;
      toast.success(`${count} tâche(s) synchronisée(s) avec ZENFLOW ✅`);
      return count;
    } catch (err: any) {
      toast.error('Erreur sync ZENFLOW : ' + (err.message || 'Inconnue'));
      return 0;
    }
  }, []);

  return { syncTask, initZenflowCalendar, syncAllPending };
}
