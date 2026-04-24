import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarSync, RefreshCw, CheckCircle } from 'lucide-react';
import { useTaskSync } from '@/hooks/useTaskSync';

interface SyncPrefs {
  task_calendar_id: string | null;
  task_calendar_label: string | null;
  auto_sync_tasks: boolean;
  auto_sync_subtasks: boolean;
  sync_tasks_without_date: boolean;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

const EDGE_URL = `https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/calendar-sync`;

export default function CalendarSyncSettings() {
  const { user } = useAuth();
  const { syncAllPending } = useTaskSync();
  const [prefs, setPrefs] = useState<SyncPrefs>({
    task_calendar_id: null,
    task_calendar_label: null,
    auto_sync_tasks: true,
    auto_sync_subtasks: true,
    sync_tasks_without_date: false,
  });
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [hasGoogle, setHasGoogle] = useState(false);

  // Load prefs + synced count
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prefsData }, { count }] = await Promise.all([
        supabase
          .from('user_sync_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .not('google_event_id', 'is', null),
      ]);

      if (prefsData) {
        setPrefs({
          task_calendar_id: (prefsData as any).task_calendar_id,
          task_calendar_label: (prefsData as any).task_calendar_label,
          auto_sync_tasks: (prefsData as any).auto_sync_tasks ?? true,
          auto_sync_subtasks: (prefsData as any).auto_sync_subtasks ?? true,
          sync_tasks_without_date: (prefsData as any).sync_tasks_without_date ?? false,
        });
      }
      setSyncedCount(count ?? 0);

      // Check if Google Calendar is connected
      const { data: accounts } = await supabase
        .from('calendar_accounts')
        .select('id')
        .eq('provider', 'google')
        .eq('is_active', true)
        .limit(1);
      setHasGoogle(!!(accounts && accounts.length > 0));

      setLoading(false);
    })();
  }, [user]);

  // Fetch Google calendars list
  useEffect(() => {
    if (!hasGoogle || !user) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: account } = await supabase
          .from('calendar_accounts')
          .select('id')
          .eq('provider', 'google')
          .eq('is_active', true)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        if (!account) return;

        // Use list_calendars direction
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
        if (res.ok) {
          const data = await res.json();
          setCalendars(data.calendars || []);
        }
      } catch {
        // Ignore
      }
    })();
  }, [hasGoogle, user]);

  const updatePref = useCallback(async (key: keyof SyncPrefs, value: any) => {
    if (!user) return;
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);

    await supabase
      .from('user_sync_preferences')
      .upsert({
        user_id: user.id,
        ...newPrefs,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' });
  }, [user, prefs]);

  const handleCalendarChange = useCallback(async (calId: string) => {
    const label = calId === '__zenflow__'
      ? 'ZENFLOW'
      : calendars.find(c => c.id === calId)?.summary || calId;
    const realId = calId === '__zenflow__' ? null : calId;

    setPrefs(p => ({ ...p, task_calendar_id: realId, task_calendar_label: label }));

    if (!user) return;
    await supabase
      .from('user_sync_preferences')
      .upsert({
        user_id: user.id,
        ...prefs,
        task_calendar_id: realId,
        task_calendar_label: label,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id' });

    toast.success(`Agenda cible : ${label}`);
  }, [user, prefs, calendars]);

  const handleResync = useCallback(async () => {
    setSyncing(true);
    const count = await syncAllPending();
    setSyncedCount(prev => prev + count);
    setSyncing(false);
  }, [syncAllPending]);

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarSync className="w-5 h-5 text-primary" />
          Synchronisation des tâches
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasGoogle && (
          <p className="text-sm text-muted-foreground">
            Connecte Google Calendar dans la vue Calendrier pour activer la synchronisation des tâches.
          </p>
        )}

        {hasGoogle && (
          <>
            {/* Calendar target selector */}
            <div className="space-y-2">
              <Label>Synchroniser mes tâches dans</Label>
              <Select
                value={prefs.task_calendar_id || '__zenflow__'}
                onValueChange={handleCalendarChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Agenda ZENFLOW" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__zenflow__">📅 ZENFLOW (recommandé)</SelectItem>
                  <SelectItem value="primary">📅 Agenda principal</SelectItem>
                  {calendars
                    .filter(c => !c.primary && c.id !== 'primary')
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        📅 {c.summary}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Synchroniser les tâches</Label>
                  <p className="text-xs text-muted-foreground">Les tâches qui me sont assignées</p>
                </div>
                <Switch
                  checked={prefs.auto_sync_tasks}
                  onCheckedChange={(v) => updatePref('auto_sync_tasks', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Synchroniser les sous-tâches</Label>
                  <p className="text-xs text-muted-foreground">Les sous-tâches qui me sont assignées</p>
                </div>
                <Switch
                  checked={prefs.auto_sync_subtasks}
                  onCheckedChange={(v) => updatePref('auto_sync_subtasks', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Inclure les tâches sans date</Label>
                  <p className="text-xs text-muted-foreground">Créer un événement même sans date d'échéance</p>
                </div>
                <Switch
                  checked={prefs.sync_tasks_without_date}
                  onCheckedChange={(v) => updatePref('sync_tasks_without_date', v)}
                />
              </div>
            </div>

            {/* Status + resync */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span data-numeric className="font-numeric tabular-nums">{syncedCount}</span> tâche(s) synchronisée(s)
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResync}
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sync...' : 'Resynchroniser tout'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
