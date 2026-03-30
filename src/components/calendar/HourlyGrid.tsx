import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CornerDownRight, Video, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Task } from '@/types';
import { PRIORITY_LABELS } from '@/types';
import type { CalendarEvent } from '@/hooks/useCalendarSync';
import { getProviderMeta } from '@/components/CalendarAccountsManager';

const HOUR_HEIGHT = 60; // px per hour
const MIN_EVENT_HEIGHT = 30;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-muted text-muted-foreground',
};

// ─── Helpers ───

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMinutesFromMidnight(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getHours() * 60 + d.getMinutes();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Event positioning with overlap handling ───

interface PositionedItem {
  id: string;
  top: number;
  height: number;
  type: 'task' | 'subtask' | 'event';
  task?: Task;
  event?: CalendarEvent;
  parentTitle?: string;
  // Layout columns for overlaps
  col: number;
  totalCols: number;
}

function computePositions(
  tasks: Task[],
  events: CalendarEvent[],
  dateStr: string,
  allTasks: Task[],
): PositionedItem[] {
  const items: PositionedItem[] = [];

  // Add tasks
  tasks.forEach(t => {
    const dueDate = t.dueDate;
    if (!dueDate) return;
    // Use due date time, default to 9:00 if no time component
    const dueDateObj = new Date(dueDate);
    const hasTime = dueDateObj.getHours() !== 0 || dueDateObj.getMinutes() !== 0;
    const startMin = hasTime ? dueDateObj.getHours() * 60 + dueDateObj.getMinutes() : 9 * 60;
    const duration = t.timeEstimate || 60;

    const parentTitle = t.parentTaskId
      ? allTasks.find(p => p.id === t.parentTaskId)?.title ?? 'Tâche parente'
      : undefined;

    items.push({
      id: t.id,
      top: (startMin / 60) * HOUR_HEIGHT,
      height: Math.max(MIN_EVENT_HEIGHT, (duration / 60) * HOUR_HEIGHT),
      type: t.parentTaskId ? 'subtask' : 'task',
      task: t,
      parentTitle,
      col: 0,
      totalCols: 1,
    });
  });

  // Add external events
  events.forEach(ev => {
    if (ev.is_all_day) return;
    const startMin = getMinutesFromMidnight(ev.start_time);
    const endMin = getMinutesFromMidnight(ev.end_time);
    const duration = Math.max(30, endMin - startMin);

    items.push({
      id: ev.id,
      top: (startMin / 60) * HOUR_HEIGHT,
      height: Math.max(MIN_EVENT_HEIGHT, (duration / 60) * HOUR_HEIGHT),
      type: 'event',
      event: ev,
      col: 0,
      totalCols: 1,
    });
  });

  // Sort by top position
  items.sort((a, b) => a.top - b.top || a.height - b.height);

  // Handle overlaps: group items that overlap vertically
  const groups: PositionedItem[][] = [];
  let currentGroup: PositionedItem[] = [];
  let groupEnd = 0;

  items.forEach(item => {
    if (currentGroup.length === 0 || item.top < groupEnd) {
      currentGroup.push(item);
      groupEnd = Math.max(groupEnd, item.top + item.height);
    } else {
      if (currentGroup.length > 0) groups.push(currentGroup);
      currentGroup = [item];
      groupEnd = item.top + item.height;
    }
  });
  if (currentGroup.length > 0) groups.push(currentGroup);

  // Assign columns within each group
  groups.forEach(group => {
    const totalCols = group.length;
    group.forEach((item, i) => {
      item.col = i;
      item.totalCols = totalCols;
    });
  });

  return items;
}

// ─── All-day items bar ───

function AllDayBar({ tasks, events, onTaskClick, onEventClick, allTasks }: {
  tasks: Task[];
  events: CalendarEvent[];
  onTaskClick: (id: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  allTasks: Task[];
}) {
  const allDayEvents = events.filter(ev => ev.is_all_day);
  if (tasks.length === 0 && allDayEvents.length === 0) return null;

  return (
    <div className="border-b border-border px-2 py-1.5 bg-muted/30 flex flex-wrap gap-1">
      <span className="text-[10px] text-muted-foreground font-medium shrink-0 leading-6">Journée :</span>
      {allDayEvents.map(ev => {
        const meta = getProviderMeta(ev.provider);
        const isGoogle = ev.provider === 'google';
        return (
          <button key={ev.id} onClick={() => onEventClick(ev)}
            className="text-[11px] px-2 py-0.5 rounded bg-muted text-foreground hover:bg-accent transition-colors flex items-center gap-1">
            {isGoogle ? (
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center shrink-0">G</span>
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
            )}
            {ev.title}
          </button>
        );
      })}
    </div>
  );
}

// ─── Current time indicator ───

function CurrentTimeLine({ dateStr }: { dateStr: string }) {
  const [now, setNow] = useState(new Date());
  const todayStr = toDateStr(new Date());
  const isToday = dateStr === todayStr;

  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [isToday]);

  if (!isToday) return null;

  const minutes = now.getHours() * 60 + now.getMinutes();
  const top = (minutes / 60) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
        <div className="flex-1 h-[2px] bg-red-500" />
      </div>
    </div>
  );
}

// ─── Event card for Week view (compact) ───

function WeekEventCard({ item, onClick, widthPercent, leftPercent }: {
  item: PositionedItem;
  onClick: () => void;
  widthPercent: number;
  leftPercent: number;
}) {
  if (item.type === 'event' && item.event) {
    const ev = item.event;
    const meta = getProviderMeta(ev.provider);
    const isGoogle = ev.provider === 'google';
    return (
      <button onClick={onClick}
        className="absolute rounded px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden bg-muted/90 hover:bg-accent border border-border/50 transition-colors text-left cursor-pointer z-10"
        style={{ top: item.top, height: item.height, width: `${widthPercent}%`, left: `${leftPercent}%` }}>
        <div className="flex items-center gap-1">
          {isGoogle ? (
            <span className="w-3 h-3 rounded-full bg-red-500 text-white text-[7px] font-bold flex items-center justify-center shrink-0">G</span>
          ) : (
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
          )}
          <span className="truncate font-medium text-foreground">{ev.title}</span>
        </div>
        <div className="text-muted-foreground truncate">{formatTime(ev.start_time)}</div>
        {ev.has_meet && ev.meet_link && (
          <span className="text-[9px] text-[hsl(174,60%,30%)]">Meet</span>
        )}
      </button>
    );
  }

  const t = item.task!;
  const priorityColor = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal;

  return (
    <button onClick={onClick}
      className={`absolute rounded px-1.5 py-0.5 text-[10px] leading-tight overflow-hidden border transition-colors text-left cursor-pointer z-10 ${
        item.type === 'subtask'
          ? 'bg-accent/80 hover:bg-accent border-accent/50'
          : 'bg-primary/15 hover:bg-primary/25 border-primary/20'
      }`}
      style={{ top: item.top, height: item.height, width: `${widthPercent}%`, left: `${leftPercent}%` }}>
      <div className="flex items-center gap-1">
        {item.type === 'subtask' ? (
          <CornerDownRight className="w-2.5 h-2.5 shrink-0 text-muted-foreground" />
        ) : (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityColor.split(' ')[0].replace('bg-', 'bg-')}`} />
        )}
        <span className="truncate font-medium text-foreground">{t.title}</span>
      </div>
      {item.type === 'subtask' && item.parentTitle && (
        <div className="text-[9px] text-muted-foreground italic truncate">↑ {item.parentTitle}</div>
      )}
      {item.type === 'task' && (
        <span className={`inline-block px-1 py-0 rounded text-[9px] font-medium ${priorityColor} mt-0.5`}>
          {PRIORITY_LABELS[t.priority]}
        </span>
      )}
    </button>
  );
}

// ─── Event card for Day view (detailed) ───

function DayEventCard({ item, onClick, widthPercent, leftPercent }: {
  item: PositionedItem;
  onClick: () => void;
  widthPercent: number;
  leftPercent: number;
}) {
  if (item.type === 'event' && item.event) {
    const ev = item.event;
    const meta = getProviderMeta(ev.provider);
    const isGoogle = ev.provider === 'google';
    return (
      <button onClick={onClick}
        className="absolute rounded-lg px-2.5 py-1.5 text-xs leading-tight overflow-hidden bg-muted/90 hover:bg-accent border border-border/50 transition-colors text-left cursor-pointer z-10"
        style={{ top: item.top, height: item.height, width: `${widthPercent}%`, left: `${leftPercent}%` }}>
        <div className="flex items-center gap-1.5">
          {isGoogle ? (
            <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">G</span>
          ) : (
            <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
          )}
          <span className="font-semibold text-foreground">{ev.title}</span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto shrink-0">Événement</Badge>
        </div>
        <div className="text-muted-foreground mt-0.5">{formatTime(ev.start_time)} → {formatTime(ev.end_time)}</div>
        {ev.description && (
          <div className="text-muted-foreground mt-0.5 line-clamp-2">{ev.description}</div>
        )}
        <div className="flex items-center gap-1.5 mt-1">
          {ev.has_meet && ev.meet_link && (
            <a href={ev.meet_link} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[hsl(174,60%,30%)]/10 text-[hsl(174,60%,30%)] text-[10px] font-medium hover:bg-[hsl(174,60%,30%)]/20 transition-colors">
              <Video className="w-3 h-3" /> Meet
            </a>
          )}
          {ev.conference_id && !ev.meet_link && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-medium">
              <Video className="w-3 h-3" /> Zoom
            </span>
          )}
        </div>
      </button>
    );
  }

  const t = item.task!;
  const priorityColor = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal;

  return (
    <button onClick={onClick}
      className={`absolute rounded-lg px-2.5 py-1.5 text-xs leading-tight overflow-hidden border transition-colors text-left cursor-pointer z-10 ${
        item.type === 'subtask'
          ? 'bg-accent/80 hover:bg-accent border-accent/50'
          : 'bg-primary/15 hover:bg-primary/25 border-primary/20'
      }`}
      style={{ top: item.top, height: item.height, width: `${widthPercent}%`, left: `${leftPercent}%` }}>
      <div className="flex items-center gap-1.5">
        {item.type === 'subtask' ? (
          <CornerDownRight className="w-3 h-3 shrink-0 text-muted-foreground" />
        ) : (
          <span className="text-foreground">✓</span>
        )}
        <span className="font-semibold text-foreground">{t.title}</span>
        <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto shrink-0">
          {item.type === 'subtask' ? 'Sous-tâche' : 'Tâche'}
        </Badge>
      </div>
      {item.type === 'subtask' && item.parentTitle && (
        <div className="text-[11px] text-muted-foreground italic mt-0.5 truncate">↑ {item.parentTitle}</div>
      )}
      {t.dueDate && (
        <div className="text-muted-foreground mt-0.5">
          {formatTime(t.dueDate)}{t.timeEstimate ? ` · ${t.timeEstimate}min` : ''}
        </div>
      )}
      {t.description && (
        <div className="text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
      )}
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityColor}`}>
          {PRIORITY_LABELS[t.priority]}
        </span>
        {t.googleEventId && (
          <span className="text-[10px] text-muted-foreground">ZENFLOW</span>
        )}
      </div>
    </button>
  );
}

// ─── Main HourlyGrid component ───

interface HourlyGridProps {
  mode: 'day' | 'week';
  days: Date[]; // 1 for day, 7 for week
  tasksByDate: Map<string, { task: Task; isStart: boolean; isEnd: boolean; totalDays: number }[]>;
  externalEventsByDate: Map<string, CalendarEvent[]>;
  allTasks: Task[];
  onTaskClick: (taskId: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  accountMap: Map<string, any>;
}

export default function HourlyGrid({
  mode, days, tasksByDate, externalEventsByDate, allTasks, onTaskClick, onEventClick, accountMap,
}: HourlyGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Auto-scroll to current hour on mount
  useEffect(() => {
    if (hasScrolled.current) return;
    const now = new Date();
    const scrollTarget = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      hasScrolled.current = true;
    }, 100);
  }, []);

  // Reset scroll flag when days change
  useEffect(() => {
    hasScrolled.current = false;
  }, [days.map(d => toDateStr(d)).join(',')]);

  const todayStr = toDateStr(new Date());
  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Compute positioned items per day
  const positionedByDay = useMemo(() => {
    const map = new Map<string, PositionedItem[]>();
    days.forEach(d => {
      const ds = toDateStr(d);
      const entries = tasksByDate.get(ds) || [];
      const seen = new Set<string>();
      const dayTasks = entries.filter(e => {
        if (seen.has(e.task.id)) return false;
        seen.add(e.task.id);
        return true;
      }).map(e => e.task);

      const dayEvents = externalEventsByDate.get(ds) || [];
      map.set(ds, computePositions(dayTasks, dayEvents, ds, allTasks));
    });
    return map;
  }, [days, tasksByDate, externalEventsByDate, allTasks]);

  const isWeek = mode === 'week';
  const colWidth = isWeek ? `${100 / 7}%` : '100%';

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-border bg-muted/40 shrink-0">
        <div className="w-12 shrink-0 border-r border-border" />
        {days.map((d, i) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          const frIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
          return (
            <div key={i} className={`flex-1 text-center py-2 border-r border-border last:border-r-0 ${isToday ? 'bg-primary/10' : ''}`}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase">{DAYS_FR[frIdx]}</div>
              <div className={`text-sm font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                  {d.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events bar */}
      {days.map(d => {
        const ds = toDateStr(d);
        const events = externalEventsByDate.get(ds) || [];
        const allDay = events.filter(e => e.is_all_day);
        if (allDay.length === 0) return null;
        return null; // Handled in a combined bar below
      })}

      {/* Scrollable grid body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour labels column */}
          <div className="w-12 shrink-0 relative border-r border-border">
            {HOURS.map(h => (
              <div key={h} className="absolute w-full text-right pr-2 text-[10px] text-muted-foreground font-medium"
                style={{ top: h * HOUR_HEIGHT - 6 }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}h`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, dayIdx) => {
            const ds = toDateStr(d);
            const items = positionedByDay.get(ds) || [];
            const isToday = ds === todayStr;

            return (
              <div key={dayIdx} className={`flex-1 relative border-r border-border last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-border/50" style={{ top: h * HOUR_HEIGHT }} />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div key={`half-${h}`} className="absolute w-full border-t border-border/20" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                {/* Current time line */}
                <CurrentTimeLine dateStr={ds} />

                {/* Events */}
                {items.map(item => {
                  const widthPercent = (90 / item.totalCols);
                  const leftPercent = 5 + (item.col * widthPercent);

                  if (isWeek) {
                    return (
                      <WeekEventCard
                        key={item.id}
                        item={item}
                        onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                        widthPercent={widthPercent}
                        leftPercent={leftPercent}
                      />
                    );
                  }
                  return (
                    <DayEventCard
                      key={item.id}
                      item={item}
                      onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                      widthPercent={isWeek ? widthPercent : 90 / item.totalCols}
                      leftPercent={isWeek ? leftPercent : 5 + (item.col * (90 / item.totalCols))}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
