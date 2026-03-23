import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bell, BellOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface TaskRemindersProps {
  taskId: string;
  hasStartDate: boolean;
  hasDueDate: boolean;
}

const OFFSET_OPTIONS = [
  { key: '3d', label: '3 jours avant' },
  { key: '1d', label: '1 jour avant' },
  { key: '8h', label: '8 heures avant' },
  { key: '1h', label: '1 heure avant' },
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

export default function TaskReminders({ taskId, hasStartDate, hasDueDate }: TaskRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

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

  const toggleReminder = async (reminderType: string, offsetKey: string) => {
    const existing = reminders.find(
      r => r.reminder_type === reminderType && r.offset_key === offsetKey
    );

    if (existing) {
      await (supabase as any).from('task_reminders').delete().eq('id', existing.id);
      setReminders(prev => prev.filter(r => r.id !== existing.id));
      toast({ title: 'Rappel supprimé' });
    } else {
      const { data, error } = await (supabase as any)
        .from('task_reminders')
        .insert({ task_id: taskId, reminder_type: reminderType, offset_key: offsetKey })
        .select()
        .single();
      if (data && !error) {
        setReminders(prev => [...prev, data as Reminder]);
        toast({ title: 'Rappel ajouté' });
      }
    }
  };

  const isActive = (type: string, offset: string) =>
    reminders.some(r => r.reminder_type === type && r.offset_key === offset);

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
      {availableTypes.map(type => (
        <div key={type.key}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">{type.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {OFFSET_OPTIONS.map(opt => {
              const active = isActive(type.key, opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleReminder(type.key, opt.key)}
                  className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    active
                      ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                      : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/20'
                  }`}
                >
                  {active ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
