import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Props {
  taskId: string;
  reminderType: 'before_start' | 'before_end';
  hasDate: boolean;
}

const UNIT_OPTIONS = [
  { value: 'min', label: 'min' },
  { value: 'h', label: 'h' },
  { value: 'd', label: 'j' },
] as const;

interface Reminder {
  id: string;
  task_id: string;
  reminder_type: string;
  offset_key: string;
}

function parseOffsetKey(key: string) {
  const match = key.match(/^(\d+)(min|h|d)$/);
  if (match) return { amount: parseInt(match[1]), unit: match[2] };
  return { amount: 1, unit: 'h' };
}

function formatOffset(key: string) {
  const { amount, unit } = parseOffsetKey(key);
  const labels: Record<string, string> = { min: 'min', h: 'h', d: 'j' };
  return `${amount}${labels[unit] || unit}`;
}

export default function TaskReminderInline({ taskId, reminderType, hasDate }: Props) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState('h');

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from('task_reminders')
        .select('*')
        .eq('task_id', taskId)
        .eq('reminder_type', reminderType);
      setReminders((data as Reminder[]) || []);
      setLoading(false);
    })();
  }, [taskId, reminderType]);

  if (!hasDate || loading) return null;

  const addReminder = async () => {
    const offsetKey = `${amount}${unit}`;
    if (reminders.find(r => r.offset_key === offsetKey)) {
      toast({ title: 'Ce rappel existe déjà' });
      return;
    }
    const { data, error } = await (supabase as any)
      .from('task_reminders')
      .insert({ task_id: taskId, reminder_type: reminderType, offset_key: offsetKey })
      .select()
      .single();
    if (data && !error) {
      setReminders(prev => [...prev, data as Reminder]);
      toast({ title: 'Rappel ajouté' });
    }
  };

  const removeReminder = async (id: string) => {
    await (supabase as any).from('task_reminders').delete().eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="mt-2 space-y-2">
      {reminders.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {reminders.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium">
              <Bell className="w-3 h-3" />
              {formatOffset(r.offset_key)} avant
              <button onClick={() => removeReminder(r.id)} className="ml-0.5 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={999}
          value={amount}
          onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-14 text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
        />
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
        >
          {UNIT_OPTIONS.map(u => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
        <button
          data-nm="reminder"
          onClick={addReminder}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/20 transition-colors"
        >
          <Plus className="w-3 h-3" /> Rappel
        </button>
      </div>
    </div>
  );
}
