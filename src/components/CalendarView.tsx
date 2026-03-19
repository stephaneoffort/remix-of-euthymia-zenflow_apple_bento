import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { PriorityBadge } from '@/components/TaskBadges';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function CalendarView() {
  const { getFilteredTasks, setSelectedTaskId } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

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

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">
          {MONTHS_FR[month]} {year}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-muted rounded-md transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm hover:bg-muted rounded-md transition-colors font-medium">
            Aujourd'hui
          </button>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-muted rounded-md transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1">
        {DAYS_FR.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
        ))}
        {calendarDays.map((day, i) => {
          const dateStr = day.date.toISOString().split('T')[0];
          const dayTasks = tasksByDate.get(dateStr) || [];
          const isToday = dateStr === today;

          return (
            <div
              key={i}
              className={`min-h-[100px] p-1.5 border-b border-r border-border ${
                day.isCurrentMonth ? 'bg-card' : 'bg-muted/20'
              }`}
            >
              <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                isToday ? 'bg-primary text-primary-foreground' : day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'
              }`}>
                {day.date.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map(t => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate cursor-pointer hover:bg-primary/20 transition-colors"
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">+{dayTasks.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
