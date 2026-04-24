import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Bell, AlertTriangle, Clock, ChevronRight, BellRing, BellOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, isPast, isToday, isTomorrow, subDays, subHours } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from '@/hooks/use-toast';

interface Reminder {
  id: string;
  task_id: string;
  reminder_type: string;
  offset_key: string;
}

const OFFSET_LABELS: Record<string, string> = {
  '3d': '3 jours',
  '1d': '1 jour',
  '8h': '8 heures',
  '1h': '1 heure',
};

function getOffsetMs(key: string): number {
  switch (key) {
    case '3d': return 3 * 24 * 60 * 60 * 1000;
    case '1d': return 1 * 24 * 60 * 60 * 1000;
    case '8h': return 8 * 60 * 60 * 1000;
    case '1h': return 1 * 60 * 60 * 1000;
    default: return 0;
  }
}

export default function NotificationsDropdown() {
  const { tasks, teamMembers, setSelectedTaskId, setQuickFilter } = useApp();
  const { teamMemberId } = useAuth();
  const { isSupported: pushSupported, isSubscribed: pushSubscribed, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications(teamMemberId);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    const fetchReminders = async () => {
      const { data } = await (supabase as any).from('task_reminders').select('*');
      setReminders((data as Reminder[]) || []);
    };
    fetchReminders();
  }, []);

  const notifications = useMemo(() => {
    const now = new Date();
    const notifs: { id: string; taskId: string; type: 'overdue' | 'due_today' | 'due_tomorrow' | 'urgent_no_date' | 'reminder'; title: string; detail: string; priority: string }[] = [];

    for (const task of tasks) {
      if (task.status === 'done' || dismissed.has(task.id)) continue;

      if (task.dueDate) {
        const due = new Date(task.dueDate);
        if (isPast(due) && !isToday(due)) {
          notifs.push({
            id: `overdue-${task.id}`,
            taskId: task.id,
            type: 'overdue',
            title: task.title,
            detail: `En retard de ${formatDistanceToNow(due, { locale: fr })}`,
            priority: task.priority,
          });
        } else if (isToday(due)) {
          notifs.push({
            id: `today-${task.id}`,
            taskId: task.id,
            type: 'due_today',
            title: task.title,
            detail: "Échéance aujourd'hui",
            priority: task.priority,
          });
        } else if (isTomorrow(due)) {
          notifs.push({
            id: `tomorrow-${task.id}`,
            taskId: task.id,
            type: 'due_tomorrow',
            title: task.title,
            detail: 'Échéance demain',
            priority: task.priority,
          });
        }
      } else if (task.priority === 'urgent') {
        notifs.push({
          id: `urgent-${task.id}`,
          taskId: task.id,
          type: 'urgent_no_date',
          title: task.title,
          detail: 'Tâche urgente sans échéance',
          priority: task.priority,
        });
      }
    }

    // Reminder-based notifications
    for (const reminder of reminders) {
      const task = tasks.find(t => t.id === reminder.task_id);
      if (!task || task.status === 'done' || dismissed.has(`reminder-${reminder.id}`)) continue;

      const refDate = reminder.reminder_type === 'before_start' ? task.startDate : task.dueDate;
      if (!refDate) continue;

      const target = new Date(refDate);
      const triggerTime = new Date(target.getTime() - getOffsetMs(reminder.offset_key));

      if (now >= triggerTime && now <= target) {
        const typeLabel = reminder.reminder_type === 'before_start' ? 'du début' : "de l'échéance";
        notifs.push({
          id: `reminder-${reminder.id}`,
          taskId: task.id,
          type: 'reminder',
          title: task.title,
          detail: `Rappel : ${OFFSET_LABELS[reminder.offset_key] || reminder.offset_key} avant ${typeLabel}`,
          priority: task.priority,
        });
      }
    }

    const order = { overdue: 0, reminder: 1, due_today: 2, due_tomorrow: 3, urgent_no_date: 4 };
    notifs.sort((a, b) => order[a.type] - order[b.type]);

    return notifs;
  }, [tasks, dismissed, reminders]);

  const overdueCount = notifications.filter(n => n.type === 'overdue').length;
  const totalCount = notifications.length;

  const typeIcon = (type: string) => {
    if (type === 'overdue') return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
    if (type === 'due_today') return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
    if (type === 'due_tomorrow') return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
    if (type === 'reminder') return <BellRing className="w-4 h-4 text-primary shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
  };

  const handleClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Extract taskId for legacy notifs or use reminder id
    const key = id.startsWith('reminder-') ? id : id.replace(/^(overdue|today|tomorrow|urgent)-/, '');
    setDismissed(prev => new Set(prev).add(id.startsWith('reminder-') ? id : key));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {totalCount > 0 && (
            <span data-numeric className={`font-numeric tabular-nums absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold ${
              overdueCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            }`}>
              {totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCount === 0 ? 'Aucune notification' : `${totalCount} notification${totalCount > 1 ? 's' : ''}`}
            </p>
          </div>
          {pushSupported && (
            <button
              onClick={async () => {
                if (pushSubscribed) {
                  await pushUnsubscribe();
                  toast({ title: 'Notifications push désactivées' });
                } else {
                  const result = await pushSubscribe();
                  toast({
                    title: result.ok
                      ? 'Notifications push activées'
                      : result.reason === 'permission_denied'
                        ? 'Permission refusée'
                        : result.reason === 'db_error'
                          ? "Abonnement créé côté navigateur, mais l'enregistrement a échoué"
                          : result.reason === 'unsupported'
                            ? 'Notifications push non prises en charge'
                            : "Impossible d'activer les notifications push",
                  });
                }
              }}
              className={`p-1.5 rounded-md transition-colors ${pushSubscribed ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              title={pushSubscribed ? 'Désactiver les notifications push' : 'Activer les notifications push'}
            >
              {pushSubscribed ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          )}
        </div>
        {totalCount > 0 ? (
          <ScrollArea className="max-h-80">
            <div className="divide-y divide-border">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.taskId)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                >
                  {typeIcon(n.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.detail}</p>
                  </div>
                  <button
                    onClick={(e) => handleDismiss(e, n.id)}
                    className="text-xs text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
                  >
                    ✕
                  </button>
                </button>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-4 py-8 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Tout est à jour 🎉</p>
          </div>
        )}
        {overdueCount > 0 && (
          <div className="border-t border-border px-4 py-2">
            <button
              onClick={() => { setQuickFilter('overdue'); setOpen(false); }}
              className="w-full flex items-center justify-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Voir toutes les tâches en retard
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
