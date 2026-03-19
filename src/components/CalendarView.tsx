import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { PriorityBadge } from '@/components/TaskBadges';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FR_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

export default function CalendarView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, selectedProjectId, getListsForProject } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const isMobile = useIsMobile();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const tasks = getFilteredTasks();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [year, month]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    tasks.forEach(t => {
      if (t.dueDate) {
        const key = t.dueDate;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    });
    return map;
  }, [tasks]);

  const today = new Date().toISOString().split('T')[0];
  const maxTasks = isMobile ? 1 : 3;
  const dayLabels = isMobile ? DAYS_FR_SHORT : DAYS_FR;
  const monthLabel = isMobile ? MONTHS_FR_SHORT[month] : MONTHS_FR[month];

  const handleAddTask = (dateStr: string) => {
    if (!newTaskTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || 'l1';
    addTask({
      title: newTaskTitle.trim(),
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: dateStr,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: null,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewTaskTitle('');
    setAddingForDate(null);
  };

  return (
    <div className="p-2 sm:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-4">
        <h2 className="text-sm sm:text-lg font-bold text-foreground">
          {monthLabel} {year}
        </h2>
        <div className="flex gap-0.5 sm:gap-1">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 sm:p-2 hover:bg-muted rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm hover:bg-muted rounded-md transition-colors font-medium">
            {isMobile ? 'Auj.' : "Aujourd'hui"}
          </button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 sm:p-2 hover:bg-muted rounded-md transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1">
        {dayLabels.map((d, i) => (
          <div key={i} className="py-1 sm:py-2 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          const dateStr = day.date.toISOString().split('T')[0];
          const dayTasks = tasksByDate.get(dateStr) || [];
          const isToday = dateStr === today;

          return (
            <div
              key={i}
              className={`min-h-[48px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-border ${
                day.isCurrentMonth ? 'bg-card' : 'bg-muted/20'
              }`}
            >
              <span className={`text-[10px] sm:text-xs font-medium inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full ${
                isToday ? 'bg-primary text-primary-foreground' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'
              }`}>
                {day.date.getDate()}
              </span>
              <div className="mt-0.5 sm:mt-1 space-y-0.5">
                {dayTasks.slice(0, maxTasks).map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="text-[9px] sm:text-[11px] px-1 sm:px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > maxTasks && (
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground px-1">+{dayTasks.length - maxTasks}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
