import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const CALENDAR_SYNC_URL = 'https://zfktrlupipngsegsiwyq.supabase.co/functions/v1/calendar-sync';

async function invokeCalendarSync(body: Record<string, unknown>) {
  const res = await fetch(CALENDAR_SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface CalendarAccount {
  id: string;
  user_id: string | null;
  provider: string;
  label: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  calendar_id: string | null;
  caldav_url: string | null;
  caldav_username: string | null;
  caldav_password: string | null;
  ics_url: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string | null;
  account_id: string | null;
  external_id: string | null;
  provider: string;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean;
  status: string | null;
  sync_status: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useCalendarSync() {
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    const { data } = await supabase
      .from('calendar_accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (data) setAccounts(data as unknown as CalendarAccount[]);
  }, []);

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .order('start_time', { ascending: true });
    if (data) setEvents(data as unknown as CalendarEvent[]);
  }, []);

  const syncAccount = useCallback(async (accountId: string, direction: 'pull' | 'push' | 'test' = 'pull') => {
    setSyncing(accountId);
    try {
      const data = await invokeCalendarSync({ account_id: accountId, direction });
      if (direction === 'pull') {
        await fetchEvents();
        await fetchAccounts();
        toast.success(`${data?.count ?? 0} événement(s) synchronisé(s)`);
      }
      if (direction === 'test') {
        return data?.connected ?? false;
      }
      return true;
    } catch (err: any) {
      toast.error('Erreur de synchronisation : ' + (err.message || 'Inconnue'));
      return false;
    } finally {
      setSyncing(null);
    }
  }, [fetchEvents, fetchAccounts]);

  const syncAllAccounts = useCallback(async () => {
    // Re-fetch accounts to get the latest active ones
    const { data: activeAccounts } = await supabase
      .from('calendar_accounts')
      .select('*')
      .eq('is_active', true);

    if (!activeAccounts || activeAccounts.length === 0) {
      toast.error("Aucun agenda connecté. Connecte d'abord Google Calendar.");
      return;
    }

    setLoading(true);
    try {
      for (const acc of activeAccounts) {
        await invokeCalendarSync({ account_id: acc.id, direction: 'pull' });
      }
      await fetchEvents();
      await fetchAccounts();
      toast.success('Synchronisation terminée ✅');
    } catch (err: any) {
      toast.error('Erreur de synchronisation : ' + (err.message || 'Inconnue'));
    } finally {
      setLoading(false);
    }
  }, [fetchEvents, fetchAccounts]);

  const addCalDavAccount = useCallback(async (label: string, caldavUrl: string, username: string, password: string, provider = 'caldav') => {
    const { data, error } = await supabase
      .from('calendar_accounts')
      .insert({
        provider,
        label,
        caldav_url: caldavUrl,
        caldav_username: username,
        caldav_password: password,
        is_active: true,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error('Erreur : ' + error.message);
      return null;
    }
    await fetchAccounts();
    toast.success('Agenda CalDAV ajouté');
    return data;
  }, [fetchAccounts]);

  const addIcsAccount = useCallback(async (label: string, icsUrl: string) => {
    const { data, error } = await supabase
      .from('calendar_accounts')
      .insert({
        provider: 'ics',
        label,
        ics_url: icsUrl,
        is_active: true,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error('Erreur : ' + error.message);
      return null;
    }
    await fetchAccounts();
    toast.success('Agenda ICS ajouté');
    return data;
  }, [fetchAccounts]);

  const deleteAccount = useCallback(async (accountId: string) => {
    await supabase.from('calendar_events').delete().eq('account_id', accountId);
    await supabase.from('calendar_accounts').delete().eq('id', accountId);
    await fetchAccounts();
    await fetchEvents();
    toast.success('Agenda déconnecté');
  }, [fetchAccounts, fetchEvents]);

  const pushEvent = useCallback(async (accountId: string, eventId: string, action: 'create' | 'update' | 'delete') => {
    try {
      await invokeCalendarSync({ account_id: accountId, direction: 'push', event_id: eventId, action });
      await fetchEvents();
      return true;
    } catch (err: any) {
      toast.error('Erreur push : ' + (err.message || 'Inconnue'));
      return false;
    }
  }, [fetchEvents]);

  const createCalendarEvent = useCallback(async (data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    is_all_day?: boolean;
    location?: string;
  }) => {
    // Find first active writable account
    const { data: activeAccounts } = await supabase
      .from('calendar_accounts')
      .select('*')
      .eq('is_active', true)
      .neq('provider', 'ics')
      .order('created_at', { ascending: true })
      .limit(1);

    const account = activeAccounts?.[0];

    // Insert event locally
    const { data: newEvent, error } = await supabase
      .from('calendar_events')
      .insert({
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        is_all_day: data.is_all_day ?? false,
        location: data.location || null,
        provider: account?.provider || 'google',
        account_id: account?.id || null,
        sync_status: account ? 'pending' : 'local',
      } as any)
      .select()
      .single();

    if (error) {
      toast.error('Erreur : ' + error.message);
      return null;
    }

    // Push to external calendar if account exists
    if (account && newEvent) {
      try {
        const { error: pushErr } = await supabase.functions.invoke('calendar-sync', {
          body: { account_id: account.id, direction: 'push', event_id: (newEvent as any).id, action: 'create' },
        });
        if (pushErr) throw pushErr;
        toast.success('Événement ajouté à Google Calendar ✅');
      } catch (err: any) {
        toast.error('Erreur push : ' + (err.message || 'Inconnue'));
      }
    } else {
      toast.success('Événement créé');
    }

    await fetchEvents();
    return newEvent;
  }, [fetchEvents]);

  const updateCalendarEvent = useCallback(async (eventId: string, data: {
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    is_all_day?: boolean;
    location?: string;
  }) => {
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: data.title,
        description: data.description || null,
        start_time: data.start_time,
        end_time: data.end_time,
        is_all_day: data.is_all_day ?? false,
        location: data.location || null,
        sync_status: 'pending',
      } as any)
      .eq('id', eventId);

    if (error) {
      toast.error('Erreur : ' + error.message);
      return false;
    }

    // Find the event's account for push
    const { data: ev } = await supabase
      .from('calendar_events')
      .select('account_id, external_id')
      .eq('id', eventId)
      .single();

    if (ev?.account_id && ev?.external_id) {
      try {
        const { error: pushErr } = await supabase.functions.invoke('calendar-sync', {
          body: { account_id: ev.account_id, direction: 'push', event_id: eventId, action: 'update' },
        });
        if (pushErr) throw pushErr;
        toast.success('Événement mis à jour ✅');
      } catch (err: any) {
        toast.error('Erreur push : ' + (err.message || 'Inconnue'));
      }
    } else {
      toast.success('Événement mis à jour');
    }

    await fetchEvents();
    return true;
  }, [fetchEvents]);

  const deleteCalendarEvent = useCallback(async (eventId: string) => {
    // Get event info before deleting
    const { data: ev } = await supabase
      .from('calendar_events')
      .select('account_id, external_id')
      .eq('id', eventId)
      .single();

    // Push delete to external calendar if applicable
    if (ev?.account_id && ev?.external_id) {
      try {
        const { error: pushErr } = await supabase.functions.invoke('calendar-sync', {
          body: { account_id: ev.account_id, direction: 'push', event_id: eventId, action: 'delete' },
        });
        if (pushErr) throw pushErr;
        toast.success('Événement supprimé ✅');
      } catch (err: any) {
        // Delete locally anyway
        await supabase.from('calendar_events').delete().eq('id', eventId);
        toast.error('Erreur push : ' + (err.message || 'Inconnue'));
        await fetchEvents();
        return;
      }
    } else {
      // No external sync, just delete locally
      await supabase.from('calendar_events').delete().eq('id', eventId);
      toast.success('Événement supprimé');
    }

    await fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchAccounts();
    fetchEvents();
  }, [fetchAccounts, fetchEvents]);

  return {
    accounts,
    events,
    loading,
    syncing,
    syncAccount,
    syncAllAccounts,
    addCalDavAccount,
    addIcsAccount,
    deleteAccount,
    pushEvent,
    fetchAccounts,
    fetchEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
  };
}
