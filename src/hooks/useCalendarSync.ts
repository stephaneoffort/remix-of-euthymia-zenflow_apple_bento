import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: { account_id: accountId, direction },
      });
      if (error) throw error;
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
    setLoading(true);
    for (const acc of accounts) {
      await syncAccount(acc.id, 'pull');
    }
    setLoading(false);
  }, [accounts, syncAccount]);

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
      const { error } = await supabase.functions.invoke('calendar-sync', {
        body: { account_id: accountId, direction: 'push', event_id: eventId, action },
      });
      if (error) throw error;
      await fetchEvents();
      return true;
    } catch (err: any) {
      toast.error('Erreur push : ' + (err.message || 'Inconnue'));
      return false;
    }
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
  };
}
