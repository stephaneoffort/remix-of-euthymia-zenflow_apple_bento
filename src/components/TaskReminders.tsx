import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, Plus, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TaskRemindersProps {
  taskId: string;
  hasStartDate: boolean;
  hasDueDate: boolean;
}

const UNIT_OPTIONS = [
  { value: 'min', label: 'minutes' },
  { value: 'h', label: 'heures' },
  { value: 'd', label: 'jours' },
] as const;

const REMINDER_TYPES = [
  { key: 'before_start', label: 'Avant le début' },
  { key: 'before_end', label: "Avant l'échéance" },
] as const;

interface Reminder {
  id: string;
  task_id: string;
  reminder_type: string;
  offset_key: string;
}

function parseOffsetKey(key: string): { amount: number; unit: string } {
  const match = key.match(/^(\d+)(min|h|d)$/);
  if (match) return { amount: parseInt(match[1]), unit: match[2] };
  return { amount: 1, unit: 'h' };
}

function formatOffset(key: string): string {
  const { amount, unit } = parseOffsetKey(key);
  const labels: Record<string, string> = { min: 'min', h: 'h', d: 'j' };
  return `${amount}${labels[unit] || unit}`;
}

export default function TaskReminders({ taskId, hasStartDate, hasDueDate }: TaskRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAmount, setNewAmount] = useState<Record<string, number>>({});
  const [newUnit, setNewUnit] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchReminders();
  }, [taskId]);

  const fetchReminders = async () => {
    const { data } = await (supabase as any)
      .from('task_reminders')
      .select('*')
      .eq('task_id', taskId);
    setReminders((data as Reminder[]) || []);
    setLoading(false);
  };

  const addReminder = async (reminderType: string) => {
    const amount = newAmount[reminderType] || 1;
    const unit = newUnit[reminderType] || 'h';
    const offsetKey = `${amount}${unit}`;

    const existing = reminders.find(
      r => r.reminder_type === reminderType && r.offset_key === offsetKey
    );
    if (existing) {
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
    toast({ title: 'Rappel supprimé' });
  };

  const availableTypes = REMINDER_TYPES.filter(t =>
    (t.key === 'before_start' && hasStartDate) || (t.key === 'before_end' && hasDueDate)
  );

  if (!hasStartDate && !hasDueDate) {
    return (
      <div className="text-xs text-muted-foreground italic">
        Ajoutez une date de début ou d'échéance pour configurer les rappels.
      </div>
    );
  }

  if (loading) return null;

  return (
    <div className="space-y-3">
      {availableTypes.map(type => {
        const typeReminders = reminders.filter(r => r.reminder_type === type.key);
        const amount = newAmount[type.key] || 1;
        const unit = newUnit[type.key] || 'h';

        return (
          <div key={type.key}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">{type.label}</p>

            {/* Existing reminders */}
            {typeReminders.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {typeReminders.map(r => (
                  <span
                    key={r.id}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium"
                  >
                    <Bell className="w-3 h-3" />
                    {formatOffset(r.offset_key)} avant
                    <button
                      onClick={() => removeReminder(r.id)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add new reminder */}
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={999}
                value={amount}
                onChange={e => setNewAmount(prev => ({ ...prev, [type.key]: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-14 text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
              />
              <select
                value={unit}
                onChange={e => setNewUnit(prev => ({ ...prev, [type.key]: e.target.value }))}
                className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground"
              >
                {UNIT_OPTIONS.map(u => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <button
                data-nm="reminder"
                onClick={() => addReminder(type.key)}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border text-foreground hover:text-primary hover:border-primary/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ajouter
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
