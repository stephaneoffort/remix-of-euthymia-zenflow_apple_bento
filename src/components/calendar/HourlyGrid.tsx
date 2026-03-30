import React, { useEffect, useRef, useState, useMemo } from 'react';
import { CornerDownRight, Video, ExternalLink, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Task } from '@/types';
import { PRIORITY_LABELS } from '@/types';
import type { CalendarEvent } from '@/hooks/useCalendarSync';
import { getProviderMeta } from '@/components/CalendarAccountsManager';

// ─── Constants ───
const HOUR_HEIGHT = 64;
const MIN_EVENT_HEIGHT = 44;
const MAX_EVENT_HEIGHT = 240;
const MAX_VISIBLE_OVERLAPS = 3;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Card colors by type ───
const CARD_COLORS = {
  event: 'bg-[#2D8CFF] text-white border-[#2D8CFF]/60',
  task: 'bg-[#7C3AED] text-white border-[#7C3AED]/60',
  subtask: 'bg-[#A78BFA] text-white border-[#A78BFA]/60',
  done: 'bg-[#6B7280] text-white border-[#6B7280]/60',
  overdue: 'bg-[#EF4444] text-white border-[#EF4444]/60',
};

function getCardColor(item: PositionedItem): string {
  if (item.type === 'event') return CARD_COLORS.event;
  const t = item.task!;
  if (t.status === 'done') return CARD_COLORS.done;
  if (t.dueDate && t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'done') return CARD_COLORS.overdue;
  if (item.type === 'subtask') return CARD_COLORS.subtask;
  return CARD_COLORS.task;
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
  hidden?: boolean; // overflow items
}

// ─── Compute positions with max 3 overlap ───

function computePositions(
  tasks: Task[],
  events: CalendarEvent[],
  allTasks: Task[],
): { timed: PositionedItem[]; allDay: PositionedItem[] } {
  const timed: PositionedItem[] = [];
  const allDay: PositionedItem[] = [];

  tasks.forEach(t => {
    if (!t.dueDate) return;
    const dueDateObj = new Date(t.dueDate);
    const hasTime = hasTimeComponent(t.dueDate);

    const parentTitle = t.parentTaskId
      ? allTasks.find(p => p.id === t.parentTaskId)?.title ?? 'Tâche parente'
      : undefined;

    if (!hasTime) {
      allDay.push({
        id: t.id, top: 0, height: 28,
        type: t.parentTaskId ? 'subtask' : 'task',
        task: t, parentTitle, col: 0, totalCols: 1,
      });
      return;
    }

    const startMin = dueDateObj.getHours() * 60 + dueDateObj.getMinutes();
    const duration = t.timeEstimate || 60;
    const rawHeight = (duration / 60) * HOUR_HEIGHT;
    const height = Math.min(MAX_EVENT_HEIGHT, Math.max(MIN_EVENT_HEIGHT, rawHeight));

    timed.push({
      id: t.id,
      top: (startMin / 60) * HOUR_HEIGHT,
      height,
      type: t.parentTaskId ? 'subtask' : 'task',
      task: t, parentTitle, col: 0, totalCols: 1,
    });
  });

  events.forEach(ev => {
    if (ev.is_all_day) {
      allDay.push({
        id: ev.id, top: 0, height: 28,
        type: 'event', event: ev, col: 0, totalCols: 1,
      });
      return;
    }

    const startMin = getMinutesFromMidnight(ev.start_time);
    const endMin = getMinutesFromMidnight(ev.end_time);
    const duration = Math.max(0, endMin - startMin);
    const rawHeight = duration === 0 ? MIN_EVENT_HEIGHT : (duration / 60) * HOUR_HEIGHT;
    const height = Math.min(MAX_EVENT_HEIGHT, Math.max(MIN_EVENT_HEIGHT, rawHeight));

    timed.push({
      id: ev.id,
      top: (startMin / 60) * HOUR_HEIGHT,
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
    const visibleCount = Math.min(group.length, MAX_VISIBLE_OVERLAPS);
    group.forEach((item, i) => {
      if (i < MAX_VISIBLE_OVERLAPS) {
        item.col = i;
        item.totalCols = visibleCount;
        item.hidden = false;
      } else {
        item.col = MAX_VISIBLE_OVERLAPS - 1;
        item.totalCols = visibleCount;
        item.hidden = true;
      }
    });
  });

  return { timed, allDay };
}

// ─── All-day zone ───

function AllDayZone({ items, onTaskClick, onEventClick }: {
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
          const color = getCardColor(item);
          const title = item.task?.title || item.event?.title || '';
          const truncated = title.length > 20 ? title.slice(0, 20) + '…' : title;

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                  className={`h-7 px-2.5 rounded-md text-[11px] font-medium border transition-opacity hover:opacity-80 truncate max-w-[200px] ${color}`}
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
  const timeLabel = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="absolute left-0 right-0 z-40 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-[10px] h-[10px] rounded-full bg-[#EF4444] -ml-[5px] shrink-0 shadow-sm" />
        <div className="flex-1 h-[2px] bg-[#EF4444] shadow-sm" />
      </div>
      <span className="absolute -left-0 -top-4 text-[9px] font-bold text-[#EF4444] ml-3">{timeLabel}</span>
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
          className="absolute z-20 rounded px-1.5 py-0.5 text-[10px] font-bold bg-muted text-foreground border border-border hover:bg-accent transition-colors cursor-pointer"
          style={{ top: top + 2, right: 4, height: Math.min(24, height - 4) }}
          onClick={e => e.stopPropagation()}
        >
          +{items.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1.5" align="end">
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{items.length} autres</p>
        {items.map(item => {
          const title = item.task?.title || item.event?.title || '';
          const color = getCardColor(item);
          return (
            <button
              key={item.id}
              onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:opacity-80 transition-opacity mb-0.5 ${color}`}
            >
              <span className="truncate">{title}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ─── Event card (unified, adapts to size) ───

function EventCard({ item, onClick, widthPercent, leftPercent, isDay }: {
  item: PositionedItem;
  onClick: () => void;
  widthPercent: number;
  leftPercent: number;
  isDay: boolean;
}) {
  const color = getCardColor(item);
  const h = item.height;
  const showTime = h >= 50;
  const showParent = h >= 60;

  if (item.type === 'event' && item.event) {
    const ev = item.event;
    return (
      <button onClick={onClick}
        className={`absolute rounded-md px-2 py-1 text-left cursor-pointer z-10 border overflow-hidden transition-opacity hover:opacity-90 ${color}`}
        style={{ top: item.top, height: h, width: `${widthPercent}%`, left: `${leftPercent}%` }}>
        <div className="flex items-center gap-1 min-w-0">
          <span className="truncate text-[12px] font-medium leading-tight">{ev.title}</span>
          {(ev.has_meet || ev.conference_id) && <Video className="w-3 h-3 shrink-0 opacity-80" />}
        </div>
        {showTime && (
          <div className="text-[11px] opacity-70 truncate">{formatTime(ev.start_time)} → {formatTime(ev.end_time)}</div>
        )}
        {isDay && h >= 80 && ev.description && (
          <div className="text-[11px] opacity-60 line-clamp-2 mt-0.5">{ev.description}</div>
        )}
        {isDay && h >= 80 && ev.has_meet && ev.meet_link && (
          <a href={ev.meet_link} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-white/20 text-[10px] font-medium hover:bg-white/30 transition-colors">
            <Video className="w-3 h-3" /> Rejoindre
          </a>
        )}
      </button>
    );
  }

  const t = item.task!;
  return (
    <button onClick={onClick}
      className={`absolute rounded-md px-2 py-1 text-left cursor-pointer z-10 border overflow-hidden transition-opacity hover:opacity-90 ${color}`}
      style={{ top: item.top, height: h, width: `${widthPercent}%`, left: `${leftPercent}%`, maxHeight: MAX_EVENT_HEIGHT, overflowY: h >= MAX_EVENT_HEIGHT ? 'auto' : 'hidden' }}>
      <div className="flex items-center gap-1 min-w-0">
        {item.type === 'subtask' ? (
          <CornerDownRight className="w-3 h-3 shrink-0 opacity-80" />
        ) : (
          <CheckCircle2 className="w-3 h-3 shrink-0 opacity-80" />
        )}
        <span className="truncate text-[12px] font-medium leading-tight">{t.title}</span>
      </div>
      {showTime && t.dueDate && hasTimeComponent(t.dueDate) && (
        <div className="text-[11px] opacity-70 truncate">
          {formatTime(t.dueDate)}{t.timeEstimate ? ` · ${t.timeEstimate}min` : ''}
        </div>
      )}
      {showParent && item.type === 'subtask' && item.parentTitle && (
        <div className="text-[11px] opacity-60 italic truncate">↑ {item.parentTitle}</div>
      )}
      {isDay && h >= 80 && t.description && (
        <div className="text-[11px] opacity-60 line-clamp-2 mt-0.5">{t.description}</div>
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

  useEffect(() => {
    if (hasScrolled.current) return;
    const now = new Date();
    const scrollTarget = Math.max(0, (now.getHours() - 2) * HOUR_HEIGHT);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollTarget, behavior: 'smooth' });
      hasScrolled.current = true;
    }, 100);
  }, []);

  useEffect(() => {
    hasScrolled.current = false;
  }, [days.map(d => toDateStr(d)).join(',')]);

  const todayStr = toDateStr(new Date());
  const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const isDay = mode === 'day';

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
      map.set(ds, computePositions(dayTasks, dayEvents, allTasks));
    });
    return map;
  }, [days, tasksByDate, externalEventsByDate, allTasks]);

  // Collect all-day items across days
  const allDayItems = useMemo(() => {
    const items: PositionedItem[] = [];
    days.forEach(d => {
      const ds = toDateStr(d);
      const data = dataByDay.get(ds);
      if (data) items.push(...data.allDay);
    });
    return items;
  }, [days, dataByDay]);

  return (
    <div className="flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex border-b border-border bg-muted/40 shrink-0">
        <div className="w-14 shrink-0 border-r border-border" />
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

      {/* All-day zone */}
      <AllDayZone items={allDayItems} onTaskClick={onTaskClick} onEventClick={onEventClick} />

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative" style={{ height: 'calc(100vh - 220px)' }}>
        <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 relative border-r border-border">
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
            const data = dataByDay.get(ds);
            const timedItems = data?.timed || [];
            const isToday = ds === todayStr;

            // Separate visible & hidden items per overlap group
            const visible = timedItems.filter(i => !i.hidden);
            const hiddenGroups = new Map<number, PositionedItem[]>();
            timedItems.filter(i => i.hidden).forEach(i => {
              const key = Math.round(i.top);
              if (!hiddenGroups.has(key)) hiddenGroups.set(key, []);
              hiddenGroups.get(key)!.push(i);
            });

            return (
              <div key={dayIdx} className={`flex-1 relative border-r border-border last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} className="absolute w-full border-t border-border/50" style={{ top: h * HOUR_HEIGHT }} />
                ))}
                {HOURS.map(h => (
                  <div key={`half-${h}`} className="absolute w-full border-t border-border/20" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                <CurrentTimeLine dateStr={ds} />

                {/* Visible cards */}
                {visible.map(item => {
                  let widthPercent: number;
                  if (item.totalCols === 1) widthPercent = 95;
                  else if (item.totalCols === 2) widthPercent = 47;
                  else widthPercent = 30;
                  const gap = 1;
                  const leftPercent = 2.5 + item.col * (widthPercent + gap);

                  return (
                    <EventCard
                      key={item.id}
                      item={item}
                      isDay={isDay}
                      onClick={() => item.task ? onTaskClick(item.task.id) : item.event && onEventClick(item.event)}
                      widthPercent={widthPercent}
                      leftPercent={leftPercent}
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
