import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

const EDGE_URL = `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/calendar-sync`;

export function useGoogleCalendars() {
  const { user } = useAuth();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [defaultCalendarId, setDefaultCalendarId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Check Google account + fetch prefs in parallel
      const [{ data: accounts }, { data: prefs }] = await Promise.all([
        supabase
          .from('calendar_accounts')
          .select('id')
          .eq('provider', 'google')
          .eq('is_active', true)
          .limit(1),
        supabase
          .from('user_sync_preferences')
          .select('task_calendar_id')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const connected = !!(accounts && accounts.length > 0);
      setHasGoogle(connected);
      setDefaultCalendarId((prefs as any)?.task_calendar_id ?? null);

      if (!connected) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) { setLoading(false); return; }

        const { data: account } = await supabase
          .from('calendar_accounts')
          .select('id')
          .eq('provider', 'google')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (!account || cancelled) { setLoading(false); return; }

        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            account_id: account.id,
            direction: 'list_calendars',
          }),
        });

        if (res.ok && !cancelled) {
          const data = await res.json();
          setCalendars(data.calendars || []);
        }
      } catch {
        // ignore
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user]);

  return { calendars, defaultCalendarId, loading, hasGoogle };
}
