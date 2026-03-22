import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Bell, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow, isPast, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotificationsDropdown() {
  const { tasks, teamMembers, setSelectedTaskId, setQuickFilter } = useApp();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const notifications = useMemo(() => {
    const now = new Date();
    const notifs: { id: string; taskId: string; type: 'overdue' | 'due_today' | 'due_tomorrow' | 'urgent_no_date'; title: string; detail: string; priority: string }[] = [];

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

    // Sort: overdue first, then today, tomorrow, urgent
    const order = { overdue: 0, due_today: 1, due_tomorrow: 2, urgent_no_date: 3 };
    notifs.sort((a, b) => order[a.type] - order[b.type]);

    return notifs;
  }, [tasks, dismissed]);

  const overdueCount = notifications.filter(n => n.type === 'overdue').length;
  const totalCount = notifications.length;

  const typeIcon = (type: string) => {
    if (type === 'overdue') return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
    if (type === 'due_today') return <Clock className="w-4 h-4 text-amber-500 shrink-0" />;
    if (type === 'due_tomorrow') return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
    return <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />;
  };

  const handleClick = (taskId: string) => {
    setSelectedTaskId(taskId);
    setOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setDismissed(prev => new Set(prev).add(taskId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          {totalCount > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[10px] font-bold ${
              overdueCount > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
            }`}>
              {totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">Notifications</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalCount === 0 ? 'Aucune notification' : `${totalCount} notification${totalCount > 1 ? 's' : ''}`}
          </p>
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
                    onClick={(e) => handleDismiss(e, n.taskId)}
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
