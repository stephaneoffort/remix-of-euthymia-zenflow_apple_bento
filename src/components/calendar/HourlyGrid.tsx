import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CornerDownRight, Video, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Task } from '@/types';
import type { CalendarEvent } from '@/hooks/useCalendarSync';

// ─── Constants ───
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getModeConfig(mode: 'day' | 'week') {
  if (mode === 'week') {
    return {
      hourHeight: 52,
      minEventHeight: 40,
      maxEventHeight: 120,
      maxOverlaps: 2,
      labelWidth: 48,
      containerHeight: 'calc(100vh - 280px)',
      cardFontSize: '11px',
      cardPadding: '3px 6px',
    };
  }
  return {
    hourHeight: 64,
    minEventHeight: 44,
    maxEventHeight: 240,
    maxOverlaps: 3,
    labelWidth: 56,
    containerHeight: 'calc(100vh - 220px)',
    cardFontSize: '12px',
    cardPadding: '4px 8px',
  };
}

// ─── Card colors using design system tokens ───
function getCardClasses(item: PositionedItem): string {
  if (item.type === 'event') {
    return 'bg-[hsl(var(--cal-event-bg))] border-l-[3px] border-l-[hsl(var(--cal-event-border))] text-[hsl(var(--cal-card-fg))]';
  }
  const t = item.task!;
  if (t.status === 'done') {
    return 'bg-[hsl(var(--cal-done-bg))] border-l-[3px] border-l-[hsl(var(--cal-done-border))] text-[hsl(var(--cal-card-fg))]';
  }
  if (t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'done') {
    return 'bg-[hsl(var(--cal-overdue-bg))] border-l-[3px] border-l-[hsl(var(--cal-overdue-border))] text-[hsl(var(--cal-card-fg))]';
  }
  if (t.status === 'in_progress') {
    return 'bg-[hsl(var(--cal-inprogress-bg))] border-l-[3px] border-l-[hsl(var(--cal-inprogress-border))] text-[hsl(var(--cal-card-fg))]';
  }
  if (item.type === 'subtask') {
    return 'bg-[hsl(var(--cal-subtask-bg))] border-l-[3px] border-l-[hsl(var(--cal-subtask-border))] text-[hsl(var(--cal-card-fg))]';
  }
  return 'bg-[hsl(var(--cal-task-bg))] border-l-[3px] border-l-[hsl(var(--cal-task-border))] text-[hsl(var(--cal-card-fg))]';
}

// Chip color for all-day zone
function getChipColor(item: PositionedItem): string {
  if (item.type === 'event') return 'bg-[hsl(var(--cal-event-border))] text-[hsl(var(--cal-card-fg))]';
  const t = item.task!;
  if (t.status === 'done') return 'bg-[hsl(var(--cal-done-border))] text-[hsl(var(--cal-card-fg))]';
  if (t.dueDate && t.dueDate < new Date().toISOString().split('T')[0]) return 'bg-[hsl(var(--cal-overdue-border))] text-[hsl(var(--cal-card-fg))]';
  if (t.status === 'in_progress') return 'bg-[hsl(var(--cal-inprogress-border))] text-[hsl(var(--cal-card-fg))]';
  if (item.type === 'subtask') return 'bg-[hsl(var(--cal-subtask-border))] text-[hsl(var(--cal-card-fg))]';
  return 'bg-[hsl(var(--cal-task-border))] text-[hsl(var(--cal-card-fg))]';
}

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

function hasTimeComponent(dateStr: string): boolean {
  const d = new Date(dateStr);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

// ─── Positioned item type ───
interface PositionedItem {
  id: string;
  top: number;
  height: number;
  type: 'task' | 'subtask' | 'event';
  task?: Task;
  event?: CalendarEvent;
  parentTitle?: string;
  col: number;
  totalCols: number;
  hidden?: boolean;
}

// ─── Compute positions ───
function computePositions(
  tasks: Task[],
  events: CalendarEvent[],
  allTasks: Task[],
  hourHeight: number,
  minEventHeight: number,
  maxEventHeight: number,
  maxOverlaps: number,
): { timed: PositionedItem[]; allDay: PositionedItem[] } {
  const timed: PositionedItem[] = [];
  const allDay: PositionedItem[] = [];

  tasks.forEach(t => {
    if (!t.dueDate) return;
    const hasTime = hasTimeComponent(t.dueDate);
    const parentTitle = t.parentTaskId
      ? allTasks.find(p => p.id === t.parentTaskId)?.title ?? 'Tâche parente'
      : undefined;

    if (!hasTime) {
      allDay.push({
        id: t.id, top: 0, height: 24,
        type: t.parentTaskId ? 'subtask' : 'task',
        task: t, parentTitle, col: 0, totalCols: 1,
      });
      return;
    }

    const dueDateObj = new Date(t.dueDate);
    const startMin = dueDateObj.getHours() * 60 + dueDateObj.getMinutes();
    const duration = t.timeEstimate || 60;
    const rawHeight = (duration / 60) * hourHeight;
    const height = Math.min(maxEventHeight, Math.max(minEventHeight, rawHeight));

    timed.push({
      id: t.id,
      top: (startMin / 60) * hourHeight,
      height,
      type: t.parentTaskId ? 'subtask' : 'task',
      task: t, parentTitle, col: 0, totalCols: 1,
    });
  });

  events.forEach(ev => {
    if (ev.is_all_day) {
      allDay.push({
        id: ev.id, top: 0, height: 24,
        type: 'event', event: ev, col: 0, totalCols: 1,
      });
      return;
    }

    const startMin = getMinutesFromMidnight(ev.start_time);
    const endMin = getMinutesFromMidnight(ev.end_time);
    const duration = Math.max(0, endMin - startMin);
    const rawHeight = duration === 0 ? minEventHeight : (duration / 60) * hourHeight;
    const height = Math.min(maxEventHeight, Math.max(minEventHeight, rawHeight));

    timed.push({
      id: ev.id,
      top: (startMin / 60) * hourHeight,
      height,
      type: 'event', event: ev, col: 0, totalCols: 1,
    });
  });

  // Sort and handle overlaps
  timed.sort((a, b) => a.top - b.top || a.height - b.height);

  const groups: PositionedItem[][] = [];
  let currentGroup: PositionedItem[] = [];
  let groupEnd = 0;

  timed.forEach(item => {
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

  groups.forEach(group => {
    const visibleCount = Math.min(group.length, maxOverlaps);
    group.forEach((item, i) => {
      if (i < maxOverlaps) {
        item.col = i;
        item.totalCols = visibleCount;
        item.hidden = false;
      } else {
        item.col = maxOverlaps - 1;
        item.totalCols = visibleCount;
        item.hidden = true;
      }
    });
  });

  return { timed, allDay };
}

// ─── Week All-day zone (per-column layout) ───
function WeekAllDayZone({ days, dataByDay, onTaskClick, onEventClick, labelWidth }: {
  days: Date[];
  dataByDay: Map<string, { timed: PositionedItem[]; allDay: PositionedItem[] }>;
  onTaskClick: (id: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  labelWidth: number;
}) {
  const hasAnyAllDay = days.some(d => {
    const data = dataByDay.get(toDateStr(d));
    return data && data.allDay.length > 0;
  });
  if (!hasAnyAllDay) return null;

  return (
    <div className="border-b border-border bg-muted/30 shrink-0 max-h-[96px] overflow-y-auto">
      <div className="flex min-h-[32px]">
        <div className="shrink-0 border-r border-border flex items-start justify-end pr-1.5 pt-1" style={{ width: labelWidth }}>
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Jour</span>
        </div>
        {days.map((d, i) => {
          const ds = toDateStr(d);
          const data = dataByDay.get(ds);
          const items = data?.allDay || [];
          const maxVisible = 3;
          const visible = items.slice(0, maxVisible);
          const overflow = items.length - maxVisible;

          return (
            <div key={i} className="flex-1 border-r border-border/30 last:border-r-0 p-1 flex flex-col gap-0.5" style={{ minWidth: 120 }}>
              {visible.map(item => {
                const title = item.task?.title || item.event?.title || '';
                const truncated = title.length > 14 ? title.slice(0, 14) + '…' : title;
                const chipColor = getChipColor(item);
                return (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                        className={`h-[22px] px-1.5 rounded text-[10px] font-medium truncate text-left transition-opacity hover:opacity-80 ${chipColor}`}
                      >
                        {item.type === 'subtask' && '↳ '}
                        {truncated}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                      <p className="font-medium">{title}</p>
                      {item.parentTitle && <p className="text-muted-foreground italic text-[10px]">↑ {item.parentTitle}</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {overflow > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="h-[20px] px-1.5 rounded text-[10px] font-bold text-muted-foreground bg-muted/50 hover:bg-muted transition-colors">
                      +{overflow}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-1.5" align="start">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{items.length} éléments</p>
                    {items.slice(maxVisible).map(item => {
                      const title = item.task?.title || item.event?.title || '';
                      const chipColor = getChipColor(item);
                      return (
                        <button
                          key={item.id}
                          onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                          className={`w-full text-left px-2 py-1 rounded text-[11px] hover:opacity-80 transition-opacity mb-0.5 ${chipColor}`}
                        >
                          <span className="truncate block">{title}</span>
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day All-day zone (flat layout) ───
function DayAllDayZone({ items, onTaskClick, onEventClick }: {
  items: PositionedItem[];
  onTaskClick: (id: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="border-b border-border bg-muted/20 shrink-0">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Toute la journée</span>
        <span className="text-[10px] text-muted-foreground">{items.length}</span>
      </div>
      <div className="px-3 pb-2 flex flex-wrap gap-1 max-h-[120px] overflow-y-auto">
        {items.map(item => {
          const chipColor = getChipColor(item);
          const title = item.task?.title || item.event?.title || '';
          const truncated = title.length > 20 ? title.slice(0, 20) + '…' : title;
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium border border-transparent transition-opacity hover:opacity-80 truncate max-w-[200px] ${chipColor}`}
                >
                  {item.type === 'subtask' && '↳ '}
                  {item.type === 'task' && '✓ '}
                  {truncated}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[250px]">
                <p className="font-medium">{title}</p>
                {item.parentTitle && <p className="text-muted-foreground italic">↑ {item.parentTitle}</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ─── Current time line ───
function CurrentTimeLine({ dateStr, hourHeight }: { dateStr: string; hourHeight: number }) {
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
  const top = (minutes / 60) * hourHeight;
  const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-[10px] h-[10px] rounded-full bg-[#EF4444] -ml-[5px] shrink-0 shadow-sm" />
        <div className="flex-1 h-[2px] bg-[#EF4444] shadow-sm" />
      </div>
      <span className="absolute -left-0 -top-4 text-[9px] font-bold text-[#EF4444] ml-2">{timeLabel}</span>
    </div>
  );
}

// ─── Overflow badge "+N" ───
function OverflowBadge({ items, top, height, onTaskClick, onEventClick }: {
  items: PositionedItem[];
  top: number;
  height: number;
  onTaskClick: (id: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute z-20 rounded px-1 py-0.5 text-[9px] font-bold bg-muted text-foreground border border-border hover:bg-accent transition-colors cursor-pointer"
          style={{ top: top + 2, right: 2, height: Math.min(20, height - 4) }}
          onClick={e => e.stopPropagation()}
        >
          +{items.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="end">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{items.length} autres</p>
        {items.map(item => {
          const title = item.task?.title || item.event?.title || '';
          const chipColor = getChipColor(item);
          return (
            <button
              key={item.id}
              onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:opacity-80 transition-opacity mb-0.5 ${chipColor}`}
            >
              <span className="truncate">{title}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─── Event card ───
function EventCard({ item, onClick, widthPercent, leftPercent, isDay, maxEventHeight, fontSize, padding }: {
  item: PositionedItem;
  onClick: () => void;
  widthPercent: number;
  leftPercent: number;
  isDay: boolean;
  maxEventHeight: number;
  fontSize: string;
  padding: string;
}) {
  const cardClasses = getCardClasses(item);
  const h = item.height;
  const showTime = h >= 44;
  const showParent = h >= 56;
  const timeFontSize = isDay ? '11px' : '10px';

  if (item.type === 'event' && item.event) {
    const ev = item.event;
    return (
      <button onClick={onClick}
        className={`absolute rounded text-left cursor-pointer z-10 overflow-hidden transition-opacity hover:opacity-90 ${cardClasses}`}
        style={{ top: item.top, height: h, width: `${widthPercent}%`, left: `${leftPercent}%`, padding, fontSize }}>
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate font-medium leading-tight">{ev.title}</span>
          {(ev.has_meet || ev.conference_id) && <Video className="w-3 h-3 shrink-0 opacity-80" />}
        </div>
        {showTime && (
          <div className="opacity-60 truncate" style={{ fontSize: timeFontSize }}>{formatTime(ev.start_time)} → {formatTime(ev.end_time)}</div>
        )}
        {isDay && h >= 80 && ev.description && (
          <div className="opacity-50 line-clamp-2 mt-0.5" style={{ fontSize: '11px' }}>{ev.description}</div>
        )}
        {isDay && h >= 80 && ev.has_meet && ev.meet_link && (
          <a href={ev.meet_link} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-background/20 text-[10px] font-medium hover:bg-background/30 transition-colors">
            <Video className="w-3 h-3" /> Rejoindre
          </a>
        )}
      </button>
    );
  }

  const t = item.task!;
  return (
    <button onClick={onClick}
      className={`absolute rounded text-left cursor-pointer z-10 overflow-hidden transition-opacity hover:opacity-90 ${cardClasses}`}
      style={{ top: item.top, height: h, width: `${widthPercent}%`, left: `${leftPercent}%`, padding, fontSize, maxHeight: maxEventHeight, overflowY: h >= maxEventHeight ? 'auto' : 'hidden' }}>
      <div className="flex items-center gap-1 min-w-0">
        {item.type === 'subtask' ? (
          <CornerDownRight className="w-3 h-3 shrink-0 opacity-80" />
        ) : (
          <CheckCircle2 className="w-3 h-3 shrink-0 opacity-80" />
        )}
        <span className="truncate font-medium leading-tight">{t.title}</span>
      </div>
      {showTime && t.dueDate && hasTimeComponent(t.dueDate) && (
        <div className="opacity-60 truncate" style={{ fontSize: timeFontSize }}>
          {formatTime(t.dueDate)}{t.timeEstimate ? ` · ${t.timeEstimate}min` : ''}
        </div>
      )}
      {showParent && item.type === 'subtask' && item.parentTitle && (
        <div className="text-white/50 italic truncate" style={{ fontSize: timeFontSize }}>↑ {item.parentTitle}</div>
      )}
      {isDay && h >= 80 && t.description && (
        <div className="text-white/50 line-clamp-2 mt-0.5" style={{ fontSize: '11px' }}>{t.description}</div>
      )}
    </button>
  );
}

// ─── Main HourlyGrid ───
interface HourlyGridProps {
  mode: 'day' | 'week';
  days: Date[];
  tasksByDate: Map<string, { task: Task; isStart: boolean; isEnd: boolean; totalDays: number }[]>;
  externalEventsByDate: Map<string, CalendarEvent[]>;
  allTasks: Task[];
  onTaskClick: (taskId: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
  accountMap: Map<string, any>;
}

export default function HourlyGrid({
  mode, days, tasksByDate, externalEventsByDate, allTasks, onTaskClick, onEventClick,
}: HourlyGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const config = getModeConfig(mode);
  const { hourHeight, minEventHeight, maxEventHeight, maxOverlaps, labelWidth } = config;
  const isDay = mode === 'day';

  useEffect(() => {
    if (hasScrolled.current) return;
    const now = new Date();
    const scrollTarget = Math.max(0, (now.getHours() - 2) * hourHeight);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      hasScrolled.current = true;
    }, 100);
  }, [hourHeight]);

  useEffect(() => {
    hasScrolled.current = false;
  }, [days.map(d => toDateStr(d)).join(',')]);

  const todayStr = toDateStr(new Date());
  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  // Compute positioned items per day
  const dataByDay = useMemo(() => {
    const map = new Map<string, { timed: PositionedItem[]; allDay: PositionedItem[] }>();
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
      map.set(ds, computePositions(dayTasks, dayEvents, allTasks, hourHeight, minEventHeight, maxEventHeight, maxOverlaps));
    });
    return map;
  }, [days, tasksByDate, externalEventsByDate, allTasks, hourHeight, minEventHeight, maxEventHeight, maxOverlaps]);

  // Day mode: collect all-day items (deduplicated)
  const dayAllDayItems = useMemo(() => {
    if (!isDay) return [];
    const seen = new Set<string>();
    const items: PositionedItem[] = [];
    days.forEach(d => {
      const data = dataByDay.get(toDateStr(d));
      if (data) {
        data.allDay.forEach(item => {
          if (!seen.has(item.id)) { seen.add(item.id); items.push(item); }
        });
      }
    });
    return items;
  }, [days, dataByDay, isDay]);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-border bg-muted/40 shrink-0" style={{ height: isDay ? undefined : 52 }}>
        <div className="shrink-0 border-r border-border" style={{ width: labelWidth }} />
        {days.map((d, i) => {
          const ds = toDateStr(d);
          const isToday = ds === todayStr;
          const frIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
          return (
            <div key={i} className={`flex-1 text-center py-1.5 border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/10' : ''}`} style={{ minWidth: isDay ? undefined : 120 }}>
              <div className="text-[10px] font-medium text-muted-foreground/60 uppercase">{DAYS_FR[frIdx]}</div>
              <div className={`text-sm font-medium ${isToday ? 'text-primary' : 'text-foreground'}`}>
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${isToday ? 'bg-[#3B82F6] text-white' : ''}`}>
                  {d.getDate()}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day zone */}
      {isDay ? (
        <DayAllDayZone items={dayAllDayItems} onTaskClick={onTaskClick} onEventClick={onEventClick} />
      ) : (
        <WeekAllDayZone days={days} dataByDay={dataByDay} onTaskClick={onTaskClick} onEventClick={onEventClick} labelWidth={labelWidth} />
      )}

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative" style={{ height: config.containerHeight }}>
        <div className="flex" style={{ height: 24 * hourHeight }}>
          {/* Hour labels */}
          <div className="shrink-0 relative border-r border-border" style={{ width: labelWidth }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full text-right pr-1.5 text-[10px] text-muted-foreground/40 font-medium"
                style={{ top: h * hourHeight - 6 }}>
                {h === 0 ? '' : `${String(h).padStart(2, '0')}h`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d, dayIdx) => {
            const ds = toDateStr(d);
            const data = dataByDay.get(ds);
            const timedItems = data?.timed || [];
            const isToday = ds === todayStr;

            const visible = timedItems.filter(i => !i.hidden);
            const hiddenGroups = new Map<number, PositionedItem[]>();
            timedItems.filter(i => i.hidden).forEach(i => {
              const key = Math.round(i.top);
              if (!hiddenGroups.has(key)) hiddenGroups.set(key, []);
              hiddenGroups.get(key)!.push(i);
            });

            return (
              <div key={dayIdx} className={`flex-1 relative border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`} style={{ minWidth: isDay ? undefined : 120 }}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-border/[0.15]" style={{ top: h * hourHeight }} />
                ))}
                {HOURS.map(h => (
                  <div key={`half-${h}`} className="absolute w-full border-t border-dashed border-border/[0.08]" style={{ top: h * hourHeight + hourHeight / 2 }} />
                ))}

                <CurrentTimeLine dateStr={ds} hourHeight={hourHeight} />

                {/* Visible cards */}
                {visible.map(item => {
                  let widthPercent: number;
                  if (isDay) {
                    if (item.totalCols === 1) widthPercent = 95;
                    else if (item.totalCols === 2) widthPercent = 47;
                    else widthPercent = 30;
                  } else {
                    if (item.totalCols === 1) widthPercent = 92;
                    else widthPercent = 44;
                  }
                  const gap = 1;
                  const leftPercent = (isDay ? 2.5 : 4) + item.col * (widthPercent + gap);

                  return (
                    <EventCard
                      key={item.id}
                      item={item}
                      isDay={isDay}
                      onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                      widthPercent={widthPercent}
                      leftPercent={leftPercent}
                      maxEventHeight={maxEventHeight}
                      fontSize={config.cardFontSize}
                      padding={config.cardPadding}
                    />
                  );
                })}

                {/* Overflow badges */}
                {Array.from(hiddenGroups.entries()).map(([key, items]) => (
                  <OverflowBadge
                    key={`overflow-${key}`}
                    items={items}
                    top={items[0].top}
                    height={items[0].height}
                    onTaskClick={onTaskClick}
                    onEventClick={onEventClick}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
