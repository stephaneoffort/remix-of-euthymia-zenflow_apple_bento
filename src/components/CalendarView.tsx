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

const MODE_LABELS: Record<CalendarMode, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

// ─── Helpers ───

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
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

// ─── Desktop Draggable Task ───

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
        {task.dueDate && (
          <p className="text-muted-foreground">Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}{task.dueDate.includes('T') && !task.dueDate.endsWith('T00:00:00.000Z') ? ` à ${new Date(task.dueDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

// ─── Droppable Day Cell ───

function DroppableDay({ dateStr, isCurrentMonth, isToday, dayNum, children, onAddClick }: {
  dateStr: string; isCurrentMonth: boolean; isToday: boolean; dayNum: number; children: React.ReactNode; onAddClick: () => void;
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
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

// ─── Mobile Task Card ───

function MobileTaskCard({ task, onClick, members, allTasks }: { task: Task; onClick: () => void; members: { id: string; name: string; avatarColor: string }[]; allTasks: Task[] }) {
  const assignees = members.filter(m => task.assigneeIds.includes(m.id));
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

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.dueDate) {
        const dateKey = t.dueDate.length > 10 ? t.dueDate.slice(0, 10) : t.dueDate;
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(t);
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
  const selectedDayTasks = tasksByDate.get(selectedDateStr) || [];

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
    if (task && (!task.dueDate || task.dueDate.slice(0, 10) !== over.id)) updateTask(active.id as string, { dueDate: new Date((over.id as string) + 'T00:00:00').toISOString() });
  };

  const exportToICS = () => {
    const tasksWithDue = tasks.filter(t => t.dueDate);
    if (tasksWithDue.length === 0) return;
    const escapeICS = (str: string) => str.replace(/[\\;,\n]/g, (m) => m === '\n' ? '\\n' : `\\${m}`);
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
    const events = tasksWithDue.map(t => {
      const dtStart = formatDate(t.dueDate!);
      return ['BEGIN:VEVENT', `UID:${t.id}@euthymia`, `DTSTART;VALUE=DATE:${dtStart}`, `DTEND;VALUE=DATE:${dtStart}`,
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
  const dayTasks = tasksByDate.get(currentDateStr) || [];

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
      : mode === 'week'
      ? `${MONTHS_FR_SHORT[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
      : `${MONTHS_FR_SHORT[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

    // Month view for mobile: show full month grid with selectable days
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
              <ModeSwitcher mode={mode} onChange={setMode} compact />
              <button onClick={exportToICS} className="p-1.5 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
              <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium">Auj.</button>
              <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-7 gap-px bg-border mx-2 rounded-lg overflow-hidden">
            {DAYS_FR_SHORT.map((d, i) => (
              <div key={i} className="py-1 text-center text-label font-semibold text-muted-foreground bg-muted/30">{d}</div>
            ))}
            {mCalDays.map((day, i) => {
              const ds = toDateStr(day.date);
              const isSelected = ds === selectedDateStr;
              const isTodayCell = ds === today;
              const hasTasks = tasksByDate.has(ds);
              return (
                <button key={i} onClick={() => setSelectedDay(new Date(day.date))}
                  className={`flex flex-col items-center py-1.5 transition-colors ${day.isCurrentMonth ? '' : 'opacity-30'} ${isSelected ? 'bg-primary/15' : isTodayCell ? 'bg-accent' : 'bg-card hover:bg-muted/50'}`}>
                  <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${isTodayCell ? 'bg-primary text-primary-foreground' : ''}`}>{day.date.getDate()}</span>
                  {hasTasks && <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? 'bg-primary' : 'bg-muted-foreground'}`} />}
                </button>
              );
            })}
          </div>
          {/* Selected day tasks */}
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
              <ModeSwitcher mode={mode} onChange={setMode} compact />
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

    // Week view mobile (default, existing behavior)
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
            <ModeSwitcher mode={mode} onChange={setMode} compact />
            <button onClick={exportToICS} className="p-1.5 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-muted-foreground" /></button>
            <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium">Auj.</button>
            <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        {/* Week strip */}
        <div className="grid grid-cols-7 gap-1 px-2 pb-2">
          {mobileWeekDays.map((d, i) => {
            const ds = toDateStr(d);
            const isSelected = ds === selectedDateStr;
            const isTodayCell = ds === today;
            const hasTasks = tasksByDate.has(ds);
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
        <ModeSwitcher mode={mode} onChange={setMode} />
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
    return (
      <div className="p-6 h-full flex flex-col">
        {sharedHeader}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1">
            {weekDays.map((d, i) => {
              const ds = toDateStr(d);
              const wdTasks = tasksByDate.get(ds) || [];
              const isTodayCell = ds === today;
              return (
                <React.Fragment key={i}>
                  {/* Header */}
                  <div className={`col-start-${i + 1} py-2 text-center border-b border-border ${isTodayCell ? 'bg-primary/10' : 'bg-muted/30'}`}>
                    <span className="text-xs font-semibold text-muted-foreground">{DAYS_FR[i]}</span>
                    <span className={`ml-1.5 text-xs font-bold ${isTodayCell ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full' : 'text-foreground'}`}>{d.getDate()}</span>
                  </div>
                </React.Fragment>
              );
            })}
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
        <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1">
          {DAYS_FR.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const dateStr = toDateStr(day.date);
            const cdTasks = tasksByDate.get(dateStr) || [];
            const isTodayCell = dateStr === today;
            return (
              <DroppableDay key={i} dateStr={dateStr} isCurrentMonth={day.isCurrentMonth} isToday={isTodayCell} dayNum={day.date.getDate()} onAddClick={() => setAddingForDate(dateStr)}>
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
        </div>
        <DragOverlay>{activeTask ? <div className="text-[11px] px-1.5 py-0.5 rounded bg-primary/20 text-primary shadow-lg border border-primary/30 max-w-[150px] truncate">{activeTask.title}</div> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
