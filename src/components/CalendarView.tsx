import React, { useState, useMemo } from 'react';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, ChevronRight, Plus, Download, Calendar as CalendarIcon, Repeat, CornerDownRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_LABELS, type Task } from '@/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

type CalendarMode = 'day' | 'week' | 'month';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FR_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAYS_FR_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  in_review: 'En revue',
  done: 'Terminé',
};

const STATUS_BAR_COLORS: Record<string, string> = {
  todo: 'bg-muted-foreground/60',
  in_progress: 'bg-primary',
  in_review: 'bg-amber-500',
  done: 'bg-green-500',
  blocked: 'bg-red-500',
};

const MODE_LABELS: Record<CalendarMode, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

// ─── Helpers ───

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function dateStrToDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    days.push(dd);
  }
  return days;
}

function getFrDayIndex(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 6 : day - 1;
}

// ─── Spanning task helpers ───

interface SpanSegment {
  task: Task;
  startCol: number;   // 0-based column in the week row
  span: number;       // number of columns to span
  isStart: boolean;   // first segment of this task
  isEnd: boolean;     // last segment of this task
  durationDays: number; // total task duration
}

function getTaskDateRange(task: Task): { start: string; end: string; duration: number } | null {
  if (!task.dueDate) return null;
  const endStr = task.dueDate.slice(0, 10);
  const startStr = task.startDate ? task.startDate.slice(0, 10) : endStr;
  const duration = diffDays(dateStrToDate(startStr), dateStrToDate(endStr));
  return { start: startStr, end: endStr, duration: Math.max(0, duration) };
}

function isMultiDay(task: Task): boolean {
  const range = getTaskDateRange(task);
  return range !== null && range.duration > 0;
}

// ─── Month/Year Picker ───

function MonthYearPicker({ year, month, onSelect }: { year: number; month: number; onSelect: (year: number, month: number) => void }) {
  const [pickerYear, setPickerYear] = useState(year);
  return (
    <div className="p-3 w-64">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setPickerYear(y => y - 1)} className="p-1 hover:bg-muted rounded transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        <span className="text-sm font-bold text-foreground">{pickerYear}</span>
        <button onClick={() => setPickerYear(y => y + 1)} className="p-1 hover:bg-muted rounded transition-colors"><ChevronRight className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS_FR_SHORT.map((m, i) => (
          <button key={i} onClick={() => onSelect(pickerYear, i)} className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${i === month && pickerYear === year ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}>{m}</button>
        ))}
      </div>
    </div>
  );
}

// ─── Mode Switcher ───

function ModeSwitcher({ mode, onChange, compact }: { mode: CalendarMode; onChange: (m: CalendarMode) => void; compact?: boolean }) {
  const modes: CalendarMode[] = ['day', 'week', 'month'];
  return (
    <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
      {modes.map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`px-2 ${compact ? 'py-1 text-[11px]' : 'py-1.5 text-xs'} rounded-md font-medium transition-colors ${
            mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

// ─── Desktop Draggable Task (single-day) ───

function DraggableTask({ task, onClick, members, allTasks }: { task: Task; onClick: () => void; members: { id: string; name: string; avatarColor: string }[]; allTasks: Task[] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const assignees = members.filter(m => task.assigneeIds.includes(m.id));
  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div ref={setNodeRef} {...listeners} {...attributes} onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`text-[11px] px-1.5 py-0.5 rounded truncate cursor-grab transition-colors flex items-center gap-1 ${
            task.parentTaskId ? 'ml-2 bg-accent/60 text-accent-foreground hover:bg-accent/80' : 'bg-primary/10 text-primary hover:bg-primary/20'
          } ${isDragging ? 'opacity-30' : ''}`}>
          {task.parentTaskId && (
            <Tooltip><TooltipTrigger asChild><CornerDownRight className="w-3 h-3 shrink-0 opacity-60" /></TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Sous-tâche de : {allTasks.find(t => t.id === task.parentTaskId)?.title ?? 'Tâche parente'}</TooltipContent></Tooltip>
          )}
          {task.recurrence && <Repeat className="w-3 h-3 shrink-0" />}
          <span className="truncate">{task.title}</span>
        </div>
      </HoverCardTrigger>
      <TaskHoverContent task={task} assignees={assignees} />
    </HoverCard>
  );
}

// ─── Spanning bar (multi-day task) ───

function SpanningBar({ segment, onClick, members, allTasks }: { segment: SpanSegment; onClick: () => void; members: { id: string; name: string; avatarColor: string }[]; allTasks: Task[] }) {
  const { task, startCol, span, isStart, isEnd, durationDays } = segment;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const barColor = STATUS_BAR_COLORS[task.status] || 'bg-primary';

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`
            absolute h-5 cursor-grab flex items-center gap-1 text-[10px] font-medium text-white
            transition-all duration-200 hover:brightness-110 hover:shadow-md z-10
            ${barColor}
            ${isStart ? 'rounded-l-md pl-1.5' : 'pl-0.5'}
            ${isEnd ? 'rounded-r-md pr-1.5' : 'pr-0.5'}
            ${isDragging ? 'opacity-30' : ''}
          `}
          style={{
            left: `calc(${(startCol / 7) * 100}% + 2px)`,
            width: `calc(${(span / 7) * 100}% - 4px)`,
            top: 0,
          }}
          title={`${task.title} (${durationDays + 1}j)`}
        >
          {isStart && (
            <>
              {task.parentTaskId && <CornerDownRight className="w-2.5 h-2.5 shrink-0 opacity-80" />}
              {task.recurrence && <Repeat className="w-2.5 h-2.5 shrink-0" />}
              <span className="truncate">{task.title}</span>
            </>
          )}
        </div>
      </HoverCardTrigger>
      <TaskHoverContent task={task} assignees={members.filter(m => task.assigneeIds.includes(m.id))} />
    </HoverCard>
  );
}

// ─── Shared hover content ───

function TaskHoverContent({ task, assignees }: { task: Task; assignees: { id: string; name: string; avatarColor: string }[] }) {
  return (
    <HoverCardContent side="right" align="start" className="w-64 p-3 space-y-2 text-xs z-50">
      <p className="font-semibold text-sm text-foreground leading-tight">{task.title}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-label font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal}`}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
        <span className="px-1.5 py-0.5 rounded text-label font-medium bg-muted text-muted-foreground">{STATUS_LABELS[task.status] || task.status}</span>
      </div>
      {assignees.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Assigné :</span>
          <div className="flex items-center gap-1">{assignees.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1">
              <span className="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: a.avatarColor }}>{a.name.charAt(0).toUpperCase()}</span>
              <span className="text-foreground">{a.name.split(' ')[0]}</span>
            </span>
          ))}</div>
        </div>
      )}
      {task.tags.length > 0 && (<div className="flex flex-wrap gap-1">{task.tags.map(tag => (<Badge key={tag} variant="secondary" className="text-label px-1.5 py-0">{tag}</Badge>))}</div>)}
      {task.startDate && task.dueDate && task.startDate.slice(0, 10) !== task.dueDate.slice(0, 10) && (
        <p className="text-muted-foreground">
          {new Date(task.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
        </p>
      )}
      {task.dueDate && !(task.startDate && task.startDate.slice(0, 10) !== task.dueDate.slice(0, 10)) && (
        <p className="text-muted-foreground">Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
      )}
    </HoverCardContent>
  );
}

// ─── Droppable Day Cell ───

function DroppableDay({ dateStr, isCurrentMonth, isToday, dayNum, children, onAddClick, extraTopPadding }: {
  dateStr: string; isCurrentMonth: boolean; isToday: boolean; dayNum: number; children: React.ReactNode; onAddClick: () => void; extraTopPadding?: number;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });
  return (
    <div ref={setNodeRef} className={`group min-h-[100px] p-1.5 border-b border-r border-border transition-colors ${isCurrentMonth ? 'bg-card' : 'bg-muted/20'} ${isOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'}`}>{dayNum}</span>
        {isCurrentMonth && (
          <button onClick={(e) => { e.stopPropagation(); onAddClick(); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all" title="Ajouter une tâche"><Plus className="w-3 h-3 text-muted-foreground" /></button>
        )}
      </div>
      {/* Reserve space for spanning bars */}
      {extraTopPadding && extraTopPadding > 0 && <div style={{ height: extraTopPadding }} />}
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Mobile Task Card ───

function MobileTaskCard({ task, onClick, members, allTasks }: { task: Task; onClick: () => void; members: { id: string; name: string; avatarColor: string }[]; allTasks: Task[] }) {
  const assignees = members.filter(m => task.assigneeIds.includes(m.id));
  const range = getTaskDateRange(task);
  const isSpanning = range && range.duration > 0;
  return (
    <button onClick={onClick} className={`w-full text-left p-3 rounded-lg border transition-colors ${task.parentTaskId ? 'ml-3 bg-accent/30 border-accent/50 hover:border-accent hover:bg-accent/40' : 'bg-card border-border hover:border-primary/30 hover:bg-accent/30'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-tight flex-1 flex items-center gap-1.5">
          {task.parentTaskId && (<Tooltip><TooltipTrigger asChild><CornerDownRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /></TooltipTrigger><TooltipContent side="top" className="text-xs">Sous-tâche de : {allTasks.find(t => t.id === task.parentTaskId)?.title ?? 'Tâche parente'}</TooltipContent></Tooltip>)}
          {task.title}
        </p>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-label font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal}`}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="px-1.5 py-0.5 rounded text-label font-medium bg-muted text-muted-foreground">{STATUS_LABELS[task.status] || task.status}</span>
        {isSpanning && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.startDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → {new Date(task.dueDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {assignees.length > 0 && (<div className="flex -space-x-1">{assignees.slice(0, 3).map(a => (<span key={a.id} className="w-5 h-5 rounded-full text-label font-bold text-white flex items-center justify-center border-2 border-card" style={{ backgroundColor: a.avatarColor }}>{a.name.charAt(0).toUpperCase()}</span>))}</div>)}
        {task.tags.length > 0 && (<div className="flex gap-1 overflow-hidden flex-1">{task.tags.slice(0, 2).map(tag => (<Badge key={tag} variant="secondary" className="text-label px-1 py-0 shrink-0">{tag}</Badge>))}</div>)}
      </div>
    </button>
  );
}

// ─── Agenda Task List (used in day & week views) ───

function AgendaTaskList({ dateStr, tasks: dayTasks, allTasks, teamMembers, setSelectedTaskId, addingForDate, setAddingForDate, newTaskTitle, setNewTaskTitle, handleAddTask, isMobile }: {
  dateStr: string; tasks: Task[]; allTasks: Task[]; teamMembers: any[]; setSelectedTaskId: (id: string) => void;
  addingForDate: string | null; setAddingForDate: (d: string | null) => void; newTaskTitle: string; setNewTaskTitle: (s: string) => void;
  handleAddTask: (d: string) => void; isMobile: boolean;
}) {
  return (
    <div className="space-y-2">
      {dayTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Aucune tâche</p>
      ) : (
        dayTasks.map(t => isMobile
          ? <MobileTaskCard key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} members={teamMembers} allTasks={allTasks} />
          : (
            <button key={t.id} onClick={() => setSelectedTaskId(t.id)} className={`w-full text-left p-3 rounded-lg border transition-colors ${t.parentTaskId ? 'ml-3 bg-accent/30 border-accent/50 hover:border-accent' : 'bg-card border-border hover:border-primary/30'}`}>
              <div className="flex items-center gap-2">
                {t.parentTaskId && <CornerDownRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                {t.recurrence && <Repeat className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                <span className="text-sm font-medium text-foreground flex-1 truncate">{t.title}</span>
                {isMultiDay(t) && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(t.startDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → {new Date(t.dueDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-label font-medium ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal}`}>{PRIORITY_LABELS[t.priority] || t.priority}</span>
                <span className="px-1.5 py-0.5 rounded text-label font-medium bg-muted text-muted-foreground">{STATUS_LABELS[t.status] || t.status}</span>
              </div>
            </button>
          )
        )
      )}
      {addingForDate === dateStr ? (
        <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddTask(dateStr); if (e.key === 'Escape') { setAddingForDate(null); setNewTaskTitle(''); } }}
          onBlur={() => { if (newTaskTitle.trim()) handleAddTask(dateStr); else { setAddingForDate(null); setNewTaskTitle(''); } }}
          placeholder="Nouvelle tâche..." className="w-full text-sm px-3 py-2.5 rounded-lg border border-primary/40 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30" />
      ) : (
        <button onClick={() => setAddingForDate(dateStr)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors text-sm">
          <Plus className="w-4 h-4" /> Ajouter une tâche
        </button>
      )}
    </div>
  );
}

// ─── Main component ───

export default function CalendarView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, updateTask, selectedProjectId, getListsForProject, teamMembers, tasks: allTasks } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [mode, setMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem('euthymia_calendar_mode');
    return (saved === 'day' || saved === 'week' || saved === 'month') ? saved : 'month';
  });

  const handleModeChange = (m: CalendarMode) => {
    setMode(m);
    localStorage.setItem('euthymia_calendar_mode', m);
  };
  const isMobile = useIsMobile();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const filteredParents = getFilteredTasks();
  const tasks = useMemo(() => {
    const parentIds = new Set(filteredParents.map(t => t.id));
    const subtasks = allTasks.filter(t => t.parentTaskId && !parentIds.has(t.id) && t.status !== 'done');
    return [...filteredParents, ...subtasks];
  }, [allTasks, filteredParents]);

  // Tasks indexed by their due date (single-day tasks only for cell rendering)
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      // For multi-day tasks, index by every day in range
      if (isMultiDay(t)) return; // handled separately
      const dateKey = t.dueDate.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(t);
    });
    return map;
  }, [tasks]);

  // Multi-day tasks
  const multiDayTasks = useMemo(() => tasks.filter(isMultiDay), [tasks]);

  // All tasks by date (including multi-day) for mobile/agenda views
  const allTasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const range = getTaskDateRange(t);
      if (!range) return;
      // Add task to each day it spans
      const startD = dateStrToDate(range.start);
      for (let i = 0; i <= range.duration; i++) {
        const ds = toDateStr(addDays(startD, i));
        if (!map.has(ds)) map.set(ds, []);
        const list = map.get(ds)!;
        if (!list.find(x => x.id === t.id)) list.push(t);
      }
    });
    return map;
  }, [tasks]);

  const today = toDateStr(new Date());
  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  // Month grid days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return days;
  }, [year, month]);

  // Week days for week view (desktop)
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  // Week days for mobile
  const mobileWeekDays = useMemo(() => getWeekDays(selectedDay), [selectedDay]);
  const selectedDateStr = toDateStr(selectedDay);
  const selectedDayTasks = allTasksByDate.get(selectedDateStr) || [];

  const handleAddTask = (dateStr: string) => {
    if (!newTaskTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || 'l1';
    addTask({
      title: newTaskTitle.trim(), description: '', status: 'todo', priority: 'normal',
      dueDate: new Date(dateStr + 'T00:00:00').toISOString(), startDate: null, assigneeIds: [], tags: [],
      parentTaskId: null, listId, comments: [], attachments: [],
      timeEstimate: null, timeLogged: null, aiSummary: null,
    });
    setNewTaskTitle('');
    setAddingForDate(null);
  };

  const handleDragStart = (event: DragStartEvent) => setActiveTaskId(event.active.id as string);
  
  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find(t => t.id === active.id);
    if (!task) return;
    
    const targetDateStr = over.id as string;
    const range = getTaskDateRange(task);
    
    if (range && range.duration > 0) {
      // Multi-day task: preserve duration, shift both dates
      const newStart = new Date(targetDateStr + 'T00:00:00');
      const newEnd = addDays(newStart, range.duration);
      updateTask(active.id as string, {
        startDate: newStart.toISOString(),
        dueDate: newEnd.toISOString(),
      });
    } else {
      // Single-day task
      if (!task.dueDate || task.dueDate.slice(0, 10) !== targetDateStr) {
        updateTask(active.id as string, {
          dueDate: new Date(targetDateStr + 'T00:00:00').toISOString(),
        });
      }
    }
  };

  const exportToICS = () => {
    const tasksWithDue = tasks.filter(t => t.dueDate);
    if (tasksWithDue.length === 0) return;
    const escapeICS = (str: string) => str.replace(/[\\;,\n]/g, (m) => m === '\n' ? '\\n' : `\\${m}`);
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
    const events = tasksWithDue.map(t => {
      const dtStart = formatDate(t.startDate && t.startDate.slice(0, 10) !== t.dueDate!.slice(0, 10) ? t.startDate.slice(0, 10) : t.dueDate!.slice(0, 10));
      const dtEnd = formatDate(t.dueDate!.slice(0, 10));
      return ['BEGIN:VEVENT', `UID:${t.id}@euthymia`, `DTSTART;VALUE=DATE:${dtStart}`, `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${escapeICS(t.title)}`, t.description ? `DESCRIPTION:${escapeICS(t.description)}` : '',
        `STATUS:${t.status === 'done' ? 'COMPLETED' : 'NEEDS-ACTION'}`,
        `PRIORITY:${t.priority === 'urgent' ? 1 : t.priority === 'high' ? 3 : t.priority === 'normal' ? 5 : 9}`,
        'END:VEVENT'].filter(Boolean).join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Euthymia//Tasks//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Euthymia - Tâches', ...events, 'END:VCALENDAR'].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'euthymia-taches.ics'; a.click();
    URL.revokeObjectURL(url);
  };

  // Navigation
  const navigatePrev = () => {
    if (mode === 'day') { const d = new Date(currentDate); d.setDate(d.getDate() - 1); setCurrentDate(d); }
    else if (mode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); }
    else { setCurrentDate(new Date(year, month - 1, 1)); }
  };
  const navigateNext = () => {
    if (mode === 'day') { const d = new Date(currentDate); d.setDate(d.getDate() + 1); setCurrentDate(d); }
    else if (mode === 'week') { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); }
    else { setCurrentDate(new Date(year, month + 1, 1)); }
  };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  // Title for current view
  const headerTitle = useMemo(() => {
    if (mode === 'day') {
      return `${DAYS_FR_FULL[getFrDayIndex(currentDate)]} ${currentDate.getDate()} ${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (mode === 'week') {
      const wk = getWeekDays(currentDate);
      const first = wk[0];
      const last = wk[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} – ${last.getDate()} ${MONTHS_FR[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTHS_FR_SHORT[first.getMonth()]} – ${last.getDate()} ${MONTHS_FR_SHORT[last.getMonth()]} ${last.getFullYear()}`;
    }
    return `${MONTHS_FR[month]} ${year}`;
  }, [mode, currentDate, month, year]);

  const currentDateStr = toDateStr(currentDate);
  const dayTasks = allTasksByDate.get(currentDateStr) || [];

  // ─── Compute spanning segments for month view ───
  const monthSpanRows = useMemo(() => {
    if (mode !== 'month' || multiDayTasks.length === 0) return [];

    const rows: SpanSegment[][] = []; // each row is a set of non-overlapping segments

    multiDayTasks.forEach(task => {
      const range = getTaskDateRange(task);
      if (!range) return;

      const taskStart = dateStrToDate(range.start);
      const taskEnd = dateStrToDate(range.end);

      // Generate segments for each week row in the calendar grid
      for (let weekIdx = 0; weekIdx < 6; weekIdx++) {
        const weekStart = calendarDays[weekIdx * 7].date;
        const weekEnd = calendarDays[weekIdx * 7 + 6].date;

        // Check if task overlaps this week
        if (taskEnd < weekStart || taskStart > weekEnd) continue;

        const segStart = taskStart < weekStart ? weekStart : taskStart;
        const segEnd = taskEnd > weekEnd ? weekEnd : taskEnd;

        const startCol = Math.max(0, diffDays(weekStart, segStart));
        const endCol = Math.min(6, diffDays(weekStart, segEnd));
        const span = endCol - startCol + 1;

        const segment: SpanSegment = {
          task,
          startCol,
          span,
          isStart: segStart.getTime() === taskStart.getTime(),
          isEnd: segEnd.getTime() === taskEnd.getTime(),
          durationDays: range.duration,
        };

        // Find a row where this segment fits (no overlap)
        let placed = false;
        for (const row of rows) {
          const conflicts = row.some(s => {
            // Same week row?
            const sWeekIdx = Math.floor(calendarDays.findIndex(cd => toDateStr(cd.date) === toDateStr(addDays(calendarDays[0].date, 0))) / 7);
            // Simpler: check if segments overlap in column space within same week
            return !(segment.startCol + segment.span <= s.startCol || s.startCol + s.span <= segment.startCol);
          });
          if (!conflicts) {
            row.push({ ...segment, _weekIdx: weekIdx } as any);
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push([{ ...segment, _weekIdx: weekIdx } as any]);
        }
      }
    });

    return rows;
  }, [mode, multiDayTasks, calendarDays]);

  // Better approach: group spanning segments by week row
  const spanSegmentsByWeek = useMemo(() => {
    if (mode !== 'month') return new Map<number, { segments: SpanSegment[]; rowCount: number }>();

    const weekMap = new Map<number, SpanSegment[][]>(); // weekIdx -> rows of segments

    multiDayTasks.forEach(task => {
      const range = getTaskDateRange(task);
      if (!range) return;

      const taskStart = dateStrToDate(range.start);
      const taskEnd = dateStrToDate(range.end);

      for (let weekIdx = 0; weekIdx < 6; weekIdx++) {
        const weekStart = calendarDays[weekIdx * 7].date;
        const weekEnd = calendarDays[weekIdx * 7 + 6].date;

        if (taskEnd < weekStart || taskStart > weekEnd) continue;

        const segStart = taskStart < weekStart ? weekStart : taskStart;
        const segEnd = taskEnd > weekEnd ? weekEnd : taskEnd;
        const startCol = diffDays(weekStart, segStart);
        const endCol = diffDays(weekStart, segEnd);
        const span = endCol - startCol + 1;

        const segment: SpanSegment = {
          task,
          startCol,
          span,
          isStart: segStart.getTime() === taskStart.getTime(),
          isEnd: segEnd.getTime() === taskEnd.getTime(),
          durationDays: range.duration,
        };

        if (!weekMap.has(weekIdx)) weekMap.set(weekIdx, []);
        const rows = weekMap.get(weekIdx)!;

        let placed = false;
        for (const row of rows) {
          const conflicts = row.some(s =>
            !(segment.startCol + segment.span <= s.startCol || s.startCol + s.span <= segment.startCol)
          );
          if (!conflicts) {
            row.push(segment);
            placed = true;
            break;
          }
        }
        if (!placed) {
          rows.push([segment]);
        }
      }
    });

    const result = new Map<number, { segments: SpanSegment[]; rowCount: number }>();
    weekMap.forEach((rows, weekIdx) => {
      const allSegments: SpanSegment[] = [];
      rows.forEach((row, rowIdx) => {
        row.forEach(seg => {
          allSegments.push({ ...seg, _rowIdx: rowIdx } as any);
        });
      });
      result.set(weekIdx, { segments: allSegments, rowCount: rows.length });
    });

    return result;
  }, [mode, multiDayTasks, calendarDays]);

  // ─── Mobile: uses selectedDay for navigation ───
  if (isMobile) {
    const navigateMobile = (dir: number) => {
      const d = new Date(selectedDay);
      if (mode === 'day') d.setDate(d.getDate() + dir);
      else if (mode === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      setSelectedDay(d);
    };

    const mobileTitle = mode === 'day'
      ? `${DAYS_FR_FULL[getFrDayIndex(selectedDay)]} ${selectedDay.getDate()} ${MONTHS_FR_SHORT[selectedDay.getMonth()]}`
      : `${MONTHS_FR_SHORT[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

    // Month view for mobile
    if (mode === 'month') {
      const mYear = selectedDay.getFullYear();
      const mMonth = selectedDay.getMonth();
      const mCalDays = (() => {
        const firstDay = new Date(mYear, mMonth, 1);
        const lastDay = new Date(mYear, mMonth + 1, 0);
        let startDay = firstDay.getDay() - 1;
        if (startDay < 0) startDay = 6;
        const days: { date: Date; isCurrentMonth: boolean }[] = [];
        for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(mYear, mMonth, -i), isCurrentMonth: false });
        for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(mYear, mMonth, i), isCurrentMonth: true });
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) days.push({ date: new Date(mYear, mMonth + 1, i), isCurrentMonth: false });
        return days;
      })();

      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-sm font-bold text-foreground hover:text-primary transition-colors">{MONTHS_FR[mMonth]} {mYear}</button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <MonthYearPicker year={mYear} month={mMonth} onSelect={(y, m) => { const d = new Date(selectedDay); d.setFullYear(y); d.setMonth(m); setSelectedDay(d); }} />
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-1">
              <ModeSwitcher mode={mode} onChange={handleModeChange} compact />
              <button onClick={exportToICS} className="p-1.5 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium">Auj.</button>
              <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px bg-border mx-2 rounded-lg overflow-hidden">
            {DAYS_FR_SHORT.map((d, i) => (
              <div key={i} className="py-1 text-center text-label font-semibold text-muted-foreground bg-muted/30">{d}</div>
            ))}
            {mCalDays.map((day, i) => {
              const ds = toDateStr(day.date);
              const isSelected = ds === selectedDateStr;
              const isTodayCell = ds === today;
              const hasTasks = allTasksByDate.has(ds);
              return (
                <button key={i} onClick={() => setSelectedDay(new Date(day.date))}
                  className={`flex flex-col items-center py-1.5 transition-colors ${day.isCurrentMonth ? '' : 'opacity-30'} ${isSelected ? 'bg-primary/15' : isTodayCell ? 'bg-accent' : 'bg-card hover:bg-muted/50'}`}>
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isTodayCell ? 'bg-primary text-primary-foreground' : ''}`}>{day.date.getDate()}</span>
                  {hasTasks && <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-primary' : 'bg-muted-foreground'}`} />}
                </button>
              );
            })}
          </div>
          <div className="px-3 py-1.5 border-t border-border bg-muted/30 mt-2">
            <p className="text-xs font-semibold text-foreground">{DAYS_FR_FULL[getFrDayIndex(selectedDay)]} {selectedDay.getDate()} {MONTHS_FR[selectedDay.getMonth()]}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
              addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
          </div>
        </div>
      );
    }

    // Day view mobile
    if (mode === 'day') {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-bold text-foreground">{mobileTitle}</span>
            <div className="flex items-center gap-1">
              <ModeSwitcher mode={mode} onChange={handleModeChange} compact />
              <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium">Auj.</button>
              <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
              addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
          </div>
        </div>
      );
    }

    // Week view mobile
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-sm font-bold text-foreground hover:text-primary transition-colors">{mobileTitle}</button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <MonthYearPicker year={selectedDay.getFullYear()} month={selectedDay.getMonth()} onSelect={(y, m) => { const d = new Date(selectedDay); d.setFullYear(y); d.setMonth(m); setSelectedDay(d); }} />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <ModeSwitcher mode={mode} onChange={handleModeChange} compact />
            <button onClick={exportToICS} className="p-1.5 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
            <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium">Auj.</button>
            <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 px-2 pb-2">
          {mobileWeekDays.map((d, i) => {
            const ds = toDateStr(d);
            const isSelected = ds === selectedDateStr;
            const isTodayCell = ds === today;
            const hasTasks = allTasksByDate.has(ds);
            return (
              <button key={i} onClick={() => setSelectedDay(new Date(d))}
                className={`flex flex-col items-center py-1.5 rounded-xl transition-all ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : isTodayCell ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                <span className={`text-label font-medium ${isSelected ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{DAYS_FR_SHORT[i]}</span>
                <span className={`text-sm font-bold mt-0.5 ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>{d.getDate()}</span>
                {hasTasks && !isSelected && <span className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
                {hasTasks && isSelected && <span className="w-1 h-1 rounded-full bg-primary-foreground mt-0.5" />}
              </button>
            );
          })}
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-muted/30">
          <p className="text-xs font-semibold text-foreground">{DAYS_FR_FULL[getFrDayIndex(selectedDay)]} {selectedDay.getDate()} {MONTHS_FR[selectedDay.getMonth()]}</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
            addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ─── Desktop layouts ───
  // ═══════════════════════════════════════════

  const sharedHeader = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-lg font-bold text-foreground hover:text-primary transition-colors">{headerTitle}</button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <MonthYearPicker year={year} month={month} onSelect={(y, m) => setCurrentDate(new Date(y, m, 1))} />
          </PopoverContent>
        </Popover>
        <ModeSwitcher mode={mode} onChange={handleModeChange} />
      </div>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={exportToICS} className="p-2 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
          </TooltipTrigger>
          <TooltipContent>Exporter (.ics) – Google Agenda, Outlook, Apple…</TooltipContent>
        </Tooltip>
        <div className="flex gap-1">
          <button onClick={navigatePrev} className="p-2 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={goToday} className="px-3 py-1.5 text-sm hover:bg-muted rounded-md transition-colors font-medium">Aujourd'hui</button>
          <button onClick={navigateNext} className="p-2 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );

  // ─── Day view (desktop) ───
  if (mode === 'day') {
    return (
      <div className="p-6 h-full flex flex-col">
        {sharedHeader}
        <div className="flex-1 overflow-y-auto max-w-2xl">
          <AgendaTaskList dateStr={currentDateStr} tasks={dayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
            addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile={false} />
        </div>
      </div>
    );
  }

  // ─── Week view (desktop) ───
  if (mode === 'week') {
    // Compute spanning segments for this week
    const weekSpanSegments = (() => {
      const weekStart = weekDays[0];
      const weekEnd = weekDays[6];
      const rows: SpanSegment[][] = [];

      multiDayTasks.forEach(task => {
        const range = getTaskDateRange(task);
        if (!range) return;
        const taskStart = dateStrToDate(range.start);
        const taskEnd = dateStrToDate(range.end);
        if (taskEnd < weekStart || taskStart > weekEnd) return;

        const segStart = taskStart < weekStart ? weekStart : taskStart;
        const segEnd = taskEnd > weekEnd ? weekEnd : taskEnd;
        const startCol = diffDays(weekStart, segStart);
        const endCol = diffDays(weekStart, segEnd);
        const span = endCol - startCol + 1;

        const segment: SpanSegment = {
          task, startCol, span,
          isStart: segStart.getTime() === taskStart.getTime(),
          isEnd: segEnd.getTime() === taskEnd.getTime(),
          durationDays: range.duration,
        };

        let placed = false;
        for (const row of rows) {
          const conflicts = row.some(s =>
            !(segment.startCol + segment.span <= s.startCol || s.startCol + s.span <= segment.startCol)
          );
          if (!conflicts) { row.push(segment); placed = true; break; }
        }
        if (!placed) rows.push([segment]);
      });

      return rows;
    })();

    return (
      <div className="p-6 h-full flex flex-col">
        {sharedHeader}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-col border border-border rounded-lg overflow-hidden flex-1">
            {/* Header row */}
            <div className="grid grid-cols-7">
              {weekDays.map((d, i) => {
                const ds = toDateStr(d);
                const isTodayCell = ds === today;
                return (
                  <div key={i} className={`py-2 text-center border-b border-r border-border ${isTodayCell ? 'bg-primary/10' : 'bg-muted/30'}`}>
                    <span className="text-xs font-semibold text-muted-foreground">{DAYS_FR[i]}</span>
                    <span className={`ml-1.5 text-xs font-bold ${isTodayCell ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full' : 'text-foreground'}`}>{d.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* Spanning bars area */}
            {weekSpanSegments.length > 0 && (
              <div className="relative border-b border-border bg-muted/10" style={{ height: weekSpanSegments.length * 24 + 4 }}>
                {weekSpanSegments.map((row, rowIdx) =>
                  row.map(seg => (
                    <div key={`${seg.task.id}-${rowIdx}`} style={{ top: rowIdx * 24 + 2 }} className="absolute w-full h-0">
                      <SpanningBar segment={seg} onClick={() => setSelectedTaskId(seg.task.id)} members={teamMembers} allTasks={allTasks} />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Day cells */}
            <div className="grid grid-cols-7 flex-1">
              {weekDays.map((d, i) => {
                const ds = toDateStr(d);
                const wdTasks = tasksByDate.get(ds) || [];
                const isTodayCell = ds === today;
                return (
                  <DroppableDay key={`body-${i}`} dateStr={ds} isCurrentMonth={true} isToday={isTodayCell} dayNum={d.getDate()} onAddClick={() => setAddingForDate(ds)}>
                    {wdTasks.map(t => (
                      <DraggableTask key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} members={teamMembers} allTasks={allTasks} />
                    ))}
                    {addingForDate === ds && (
                      <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddTask(ds); if (e.key === 'Escape') { setAddingForDate(null); setNewTaskTitle(''); } }}
                        onBlur={() => { if (newTaskTitle.trim()) handleAddTask(ds); else { setAddingForDate(null); setNewTaskTitle(''); } }}
                        placeholder="Tâche..." className="w-full text-[11px] px-1 py-0.5 rounded border border-primary/40 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
                    )}
                  </DroppableDay>
                );
              })}
            </div>
          </div>
          <DragOverlay>{activeTask ? <div className="text-[11px] px-1.5 py-0.5 rounded bg-primary/20 text-primary shadow-lg border border-primary/30 max-w-[150px] truncate">{activeTask.title}</div> : null}</DragOverlay>
        </DndContext>
      </div>
    );
  }

  // ─── Month view (desktop, default) ───
  return (
    <div className="p-6 h-full flex flex-col">
      {sharedHeader}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1 auto-rows-fr">
          {/* Day headers */}
          {DAYS_FR.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
          ))}

          {/* Calendar cells - render week by week */}
          {Array.from({ length: 6 }, (_, weekIdx) => {
            const weekCells = calendarDays.slice(weekIdx * 7, weekIdx * 7 + 7);
            const spanData = spanSegmentsByWeek.get(weekIdx);
            const spanRowCount = spanData?.rowCount || 0;
            const spanHeight = spanRowCount * 24;

            return (
              <React.Fragment key={`week-${weekIdx}`}>
                {weekCells.map((day, colIdx) => {
                  const dateStr = toDateStr(day.date);
                  const cdTasks = tasksByDate.get(dateStr) || [];
                  const isTodayCell = dateStr === today;

                  return (
                    <DroppableDay
                      key={`${weekIdx}-${colIdx}`}
                      dateStr={dateStr}
                      isCurrentMonth={day.isCurrentMonth}
                      isToday={isTodayCell}
                      dayNum={day.date.getDate()}
                      onAddClick={() => setAddingForDate(dateStr)}
                      extraTopPadding={spanHeight}
                    >
                      {/* Spanning bars overlay - only render in first column */}
                      {colIdx === 0 && spanData && spanData.segments.map((seg, si) => {
                        const rowIdx = (seg as any)._rowIdx || 0;
                        return (
                          <div
                            key={`span-${seg.task.id}-${si}`}
                            className="absolute left-0 right-0"
                            style={{ top: 28 + rowIdx * 24 + 2 }}
                          >
                            <SpanningBar
                              segment={seg}
                              onClick={() => setSelectedTaskId(seg.task.id)}
                              members={teamMembers}
                              allTasks={allTasks}
                            />
                          </div>
                        );
                      })}

                      {cdTasks.slice(0, 3).map(t => (
                        <DraggableTask key={t.id} task={t} onClick={() => setSelectedTaskId(t.id)} members={teamMembers} allTasks={allTasks} />
                      ))}
                      {cdTasks.length > 3 && <span className="text-label text-muted-foreground px-1">+{cdTasks.length - 3}</span>}
                      {addingForDate === dateStr && (
                        <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddTask(dateStr); if (e.key === 'Escape') { setAddingForDate(null); setNewTaskTitle(''); } }}
                          onBlur={() => { if (newTaskTitle.trim()) handleAddTask(dateStr); else { setAddingForDate(null); setNewTaskTitle(''); } }}
                          placeholder="Tâche..." className="w-full text-[11px] px-1 py-0.5 rounded border border-primary/40 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary" />
                      )}
                    </DroppableDay>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
        <DragOverlay>{activeTask ? <div className="text-[11px] px-1.5 py-0.5 rounded bg-primary/20 text-primary shadow-lg border border-primary/30 max-w-[150px] truncate">{activeTask.title}</div> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
