import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, ChevronRight, Plus, Download, Calendar as CalendarIcon, Repeat, CornerDownRight, ArrowRight, RefreshCw, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
import { useCalendarSync, type CalendarEvent } from '@/hooks/useCalendarSync';
import CalendarAccountsManager, { getProviderMeta } from '@/components/CalendarAccountsManager';
import SyncTargetPicker from '@/components/SyncTargetPicker';
import CalendarEventDialog from '@/components/CalendarEventDialog';

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

const STATUS_DOT_COLORS: Record<string, string> = {
  todo: 'bg-muted-foreground',
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

// ─── Desktop Draggable Task ───

function DraggableTask({ task, onClick, members, allTasks, spanInfo }: {
  task: Task; onClick: () => void;
  members: { id: string; name: string; avatarColor: string }[];
  allTasks: Task[];
  spanInfo?: { isStart: boolean; isEnd: boolean; totalDays: number };
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const assignees = members.filter(m => task.assigneeIds.includes(m.id));
  const isSpanning = !!spanInfo;
  const dotColor = STATUS_DOT_COLORS[task.status] || 'bg-primary';

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div ref={setNodeRef} {...listeners} {...attributes} onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`text-[11px] px-1.5 py-0.5 cursor-grab transition-colors flex items-center gap-1
            ${isDragging ? 'opacity-30' : ''}
            ${isSpanning
              ? `${spanInfo.isStart ? 'rounded-l' : ''} ${spanInfo.isEnd ? 'rounded-r' : ''} ${!spanInfo.isStart && !spanInfo.isEnd ? '' : ''} bg-primary/15 text-primary hover:bg-primary/25 border-y border-primary/20 ${spanInfo.isStart ? 'border-l' : 'border-l-0'} ${spanInfo.isEnd ? 'border-r' : 'border-r-0'} -mx-1.5`
              : task.parentTaskId
                ? 'rounded ml-2 bg-accent/60 text-accent-foreground hover:bg-accent/80'
                : 'rounded bg-primary/10 text-primary hover:bg-primary/20'
            }
          `}
        >
          {task.parentTaskId && !isSpanning && (
            <Tooltip><TooltipTrigger asChild><CornerDownRight className="w-3 h-3 shrink-0 opacity-60" /></TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Sous-tâche de : {allTasks.find(t => t.id === task.parentTaskId)?.title ?? 'Tâche parente'}</TooltipContent></Tooltip>
          )}
          {isSpanning && spanInfo.isStart && <span className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />}
          {task.recurrence && <Repeat className="w-3 h-3 shrink-0" />}
          {isSpanning && !spanInfo.isStart ? (
            <span className="truncate opacity-50">{spanInfo.isEnd ? task.title : '—'}</span>
          ) : (
            <span className="truncate">{task.title}</span>
          )}
          {isSpanning && spanInfo.isStart && !spanInfo.isEnd && <ArrowRight className="w-2.5 h-2.5 shrink-0 opacity-50" />}
        </div>
      </HoverCardTrigger>
      <TaskHoverContent task={task} assignees={assignees} />
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
  const multi = isMultiDay(task);
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
        {multi && task.startDate && (
          <span className="text-[10px] text-muted-foreground">
            {new Date(task.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → {new Date(task.dueDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {assignees.length > 0 && (<div className="flex -space-x-1">{assignees.slice(0, 3).map(a => (<span key={a.id} className="w-5 h-5 rounded-full text-label font-bold text-white flex items-center justify-center border-2 border-card" style={{ backgroundColor: a.avatarColor }}>{a.name.charAt(0).toUpperCase()}</span>))}</div>)}
        {task.tags.length > 0 && (<div className="flex gap-1 overflow-hidden flex-1">{task.tags.slice(0, 2).map(tag => (<Badge key={tag} variant="secondary" className="text-label px-1 py-0 shrink-0">{tag}</Badge>))}</div>)}
      </div>
    </button>
  );
}

// ─── Agenda Task List ───

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
                {isMultiDay(t) && t.startDate && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(t.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} → {new Date(t.dueDate!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
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

// ─── External Events for Agenda views ───

function AgendaExternalEvents({ dateStr, externalEventsByDate, accountMap, onEditEvent, onDeleteEvent }: {
  dateStr: string;
  externalEventsByDate: Map<string, CalendarEvent[]>;
  accountMap: Map<string, any>;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
}) {
  const events = externalEventsByDate.get(dateStr) || [];
  if (events.length === 0) return null;
  return (
    <div className="space-y-1 mb-3">
      <p className="text-xs font-semibold text-muted-foreground mb-1">Événements synchronisés</p>
      {events.map(ev => {
        const meta = getProviderMeta(ev.provider);
        const isGoogle = ev.provider === 'google';
        const timeStr = ev.is_all_day ? 'Journée' : new Date(ev.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + ' – ' + new Date(ev.end_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={ev.id} className="group flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => onEditEvent(ev)}>
            {isGoogle ? (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">G</span>
            ) : (
              <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
            )}
            <span className="text-sm font-medium text-foreground flex-1 truncate">{ev.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">{timeStr}</span>
            <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(ev); }} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all">
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function CalendarView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, updateTask, selectedProjectId, getListsForProject, teamMembers, tasks: allTasks } = useApp();
  const calSync = useCalendarSync();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogDate, setEventDialogDate] = useState<string | undefined>(undefined);
  const [mode, setMode] = useState<CalendarMode>(() => {
    const saved = localStorage.getItem('euthymia_calendar_mode');
    return (saved === 'day' || saved === 'week' || saved === 'month') ? saved : 'month';
  });

  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-sync on mount
  useEffect(() => {
    if (calSync.accounts.length > 0) {
      calSync.syncAllAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calSync.accounts.length]);

  // Handle ?connected=true after Google OAuth callback
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      (async () => {
        try {
          const { data: latestAccount } = await supabase
            .from('calendar_accounts')
            .select('*')
            .eq('provider', 'google')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          if (latestAccount) {
            await fetch('https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/calendar-sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ account_id: latestAccount.id, direction: 'pull' }),
            });
            await calSync.fetchAccounts();
            await calSync.fetchEvents();
            toast.success('Google Calendar synchronisé ✅');
          }
        } catch (err: any) {
          toast.error('Erreur de synchronisation : ' + (err.message || 'Inconnue'));
        }
        // Remove ?connected=true from URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('connected');
        setSearchParams(newParams, { replace: true });
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

  // All tasks indexed by every date they cover (for cell rendering)
  const tasksByDate = useMemo(() => {
    const map = new Map<string, { task: Task; isStart: boolean; isEnd: boolean; totalDays: number }[]>();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const range = getTaskDateRange(t);
      if (!range) return;

      if (range.duration === 0) {
        // Single-day task
        const dk = range.end;
        if (!map.has(dk)) map.set(dk, []);
        map.get(dk)!.push({ task: t, isStart: true, isEnd: true, totalDays: 1 });
      } else {
        // Multi-day: add to each day
        const startD = dateStrToDate(range.start);
        for (let i = 0; i <= range.duration; i++) {
          const dk = toDateStr(addDays(startD, i));
          if (!map.has(dk)) map.set(dk, []);
          map.get(dk)!.push({
            task: t,
            isStart: i === 0,
            isEnd: i === range.duration,
            totalDays: range.duration + 1,
          });
        }
      }
    });
    return map;
  }, [tasks]);

  // External calendar events indexed by date
  const externalEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calSync.events.forEach(ev => {
      if (!ev.start_time) return;
      const dk = ev.start_time.slice(0, 10);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk)!.push(ev);
    });
    return map;
  }, [calSync.events]);

  // Account lookup for tooltips
  const accountMap = useMemo(() => {
    const m = new Map<string, typeof calSync.accounts[0]>();
    calSync.accounts.forEach(a => m.set(a.id, a));
    return m;
  }, [calSync.accounts]);

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

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const mobileWeekDays = useMemo(() => getWeekDays(selectedDay), [selectedDay]);
  const selectedDateStr = toDateStr(selectedDay);

  // For agenda views, deduplicate tasks that appear on a given day
  const getAgendaTasks = (dateStr: string): Task[] => {
    const entries = tasksByDate.get(dateStr) || [];
    const seen = new Set<string>();
    return entries.filter(e => {
      if (seen.has(e.task.id)) return false;
      seen.add(e.task.id);
      return true;
    }).map(e => e.task);
  };

  const selectedDayTasks = getAgendaTasks(selectedDateStr);

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

  const handleOpenNewEvent = (dateStr?: string) => {
    setEditingEvent(null);
    setEventDialogDate(dateStr);
    setEventDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventDialogDate(undefined);
    setEventDialogOpen(true);
  };

  const handleDeleteEvent = async (event: CalendarEvent) => {
    await calSync.deleteCalendarEvent(event.id);
  };

  const handleSaveEvent = async (data: { title: string; description: string; start_time: string; end_time: string; is_all_day: boolean; location: string }) => {
    if (editingEvent) {
      await calSync.updateCalendarEvent(editingEvent.id, data);
    } else {
      await calSync.createCalendarEvent(data);
    }
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
      // Multi-day: preserve duration, drop target = new start date
      const newStart = new Date(targetDateStr + 'T00:00:00');
      const newEnd = addDays(newStart, range.duration);
      updateTask(active.id as string, {
        startDate: newStart.toISOString(),
        dueDate: newEnd.toISOString(),
      });
    } else {
      // Single-day
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
      const range = getTaskDateRange(t);
      const dtStart = formatDate(range?.start || t.dueDate!.slice(0, 10));
      const dtEnd = formatDate(range?.end || t.dueDate!.slice(0, 10));
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
  const dayTasks = getAgendaTasks(currentDateStr);

  // ─── Render external events for a given date ───
  const renderExternalEvents = (dateStr: string) => {
    const exts = externalEventsByDate.get(dateStr) || [];
    return exts.map(ev => {
      const meta = getProviderMeta(ev.provider);
      const acc = ev.account_id ? accountMap.get(ev.account_id) : null;
      const timeStr = ev.is_all_day ? 'Journée' : new Date(ev.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const isGoogle = ev.provider === 'google';
      return (
        <Tooltip key={ev.id}>
          <TooltipTrigger asChild>
            <div className="text-[11px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1 cursor-default">
              {isGoogle ? (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">G</span>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
              )}
              <span className="truncate">{ev.title}</span>
              <span className="text-[9px] shrink-0 opacity-70">{timeStr}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs max-w-[200px]">
            <p className="font-medium">{ev.title}</p>
            <p className="text-muted-foreground">
              Synchronisé depuis {acc?.label || meta.label}
              {ev.last_synced_at && ` · ${new Date(ev.last_synced_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
            </p>
            {ev.location && <p className="text-muted-foreground">📍 {ev.location}</p>}
          </TooltipContent>
        </Tooltip>
      );
    });
  };

  // ─── Render cell tasks for grid views ───
  const renderCellTasks = (dateStr: string, maxVisible = 4) => {
    const entries = tasksByDate.get(dateStr) || [];
    // Separate spanning (multi-day) tasks first, then single-day
    const spanning = entries.filter(e => e.totalDays > 1);
    const single = entries.filter(e => e.totalDays === 1);
    const all = [...spanning, ...single];
    const externalEvts = externalEventsByDate.get(dateStr) || [];
    const totalItems = all.length + externalEvts.length;
    const extSlots = Math.max(0, maxVisible - all.length);
    const visibleTasks = all.slice(0, maxVisible);
    const visibleExts = externalEvts.slice(0, extSlots);
    const overflow = totalItems - visibleTasks.length - visibleExts.length;

    return (
      <>
        {visibleTasks.map(entry => (
          <DraggableTask
            key={`${entry.task.id}-${dateStr}`}
            task={entry.task}
            onClick={() => setSelectedTaskId(entry.task.id)}
            members={teamMembers}
            allTasks={allTasks}
            spanInfo={entry.totalDays > 1 ? { isStart: entry.isStart, isEnd: entry.isEnd, totalDays: entry.totalDays } : undefined}
          />
        ))}
        {visibleExts.map(ev => {
          const meta = getProviderMeta(ev.provider);
          const acc = ev.account_id ? accountMap.get(ev.account_id) : null;
          const timeStr = ev.is_all_day ? '' : new Date(ev.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          const isGoogle = ev.provider === 'google';
          return (
            <Tooltip key={ev.id}>
              <TooltipTrigger asChild>
                <div className="text-[11px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1 cursor-default">
                  {isGoogle ? (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">G</span>
                  ) : (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                  )}
                  <span className="truncate">{ev.title}</span>
                  {timeStr && <span className="text-[9px] shrink-0 opacity-70">{timeStr}</span>}
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-[200px]">
                <p className="font-medium">{ev.title}</p>
                <p className="text-muted-foreground">Synchronisé depuis {acc?.label || meta.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        {overflow > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-label text-primary font-semibold px-1 py-0.5 rounded hover:bg-primary/10 transition-colors cursor-pointer">
                +{overflow}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 max-h-64 overflow-y-auto p-2" side="bottom" align="start">
              <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">{overflow} élément{overflow > 1 ? 's' : ''} supplémentaire{overflow > 1 ? 's' : ''}</p>
              <div className="flex flex-col gap-1">
                {all.slice(maxVisible).map(entry => {
                  const t = entry.task;
                  const dueStr = t.dueDate ? new Date(t.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-accent transition-colors w-full"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT_COLORS[t.status] || 'bg-muted-foreground'}`} />
                      <span className="text-xs text-foreground truncate flex-1">{t.title}</span>
                      <span className={`shrink-0 px-1 py-0.5 rounded text-[10px] font-medium leading-none ${PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.normal}`}>
                        {PRIORITY_LABELS[t.priority] || t.priority}
                      </span>
                      {dueStr && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{dueStr}</span>
                      )}
                    </button>
                  );
                })}
                {externalEvts.slice(extSlots).map(ev => {
                  const meta = getProviderMeta(ev.provider);
                  const isGoogle = ev.provider === 'google';
                  return (
                    <div key={ev.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md w-full">
                      {isGoogle ? (
                        <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">G</span>
                      ) : (
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                      )}
                      <span className="text-xs text-muted-foreground truncate flex-1">{ev.title}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {ev.is_all_day ? 'Journée' : new Date(ev.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </>
    );
  };

  const eventDialogElement = (
    <CalendarEventDialog
      open={eventDialogOpen}
      onClose={() => { setEventDialogOpen(false); setEditingEvent(null); }}
      onSave={handleSaveEvent}
      onDelete={editingEvent ? () => handleDeleteEvent(editingEvent) : undefined}
      event={editingEvent}
      defaultDate={eventDialogDate}
    />
  );

  // ─── Mobile layouts ───
  if (isMobile) {
    const handleConnectGoogle = () => {
      window.open('https://zfktrlupipngsegsiwyq.supabase.co/functions/v1/google-oauth/authorize', '_blank');
    };

    const mobileActionBar = (
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <button
          onClick={handleConnectGoogle}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors"
        >
          📅 Google
        </button>
        <button
          onClick={() => calSync.syncAllAccounts()}
          disabled={calSync.loading}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md hover:bg-muted transition-colors text-foreground disabled:opacity-50"
        >
          {calSync.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Sync
        </button>
      </div>
    );

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
              <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
              <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium text-foreground">Auj.</button>
              <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-foreground" /></button>
            </div>
          </div>
          {mobileActionBar}
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
          <div className="px-3 py-1.5 border-t border-border bg-muted/30 mt-2">
            <p className="text-xs font-semibold text-foreground">{DAYS_FR_FULL[getFrDayIndex(selectedDay)]} {selectedDay.getDate()} {MONTHS_FR[selectedDay.getMonth()]}</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <AgendaExternalEvents dateStr={selectedDateStr} externalEventsByDate={externalEventsByDate} accountMap={accountMap} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} />
            <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
              addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
            <button onClick={() => handleOpenNewEvent(selectedDateStr)} className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors text-sm">
              <CalendarIcon className="w-4 h-4" /> Ajouter un événement
            </button>
          </div>
          {eventDialogElement}
        </div>
      );
    }

    if (mode === 'day') {
      return (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-sm font-bold text-foreground">{mobileTitle}</span>
            <div className="flex items-center gap-1">
              <ModeSwitcher mode={mode} onChange={handleModeChange} compact />
              <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
              <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium text-foreground">Auj.</button>
              <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-foreground" /></button>
            </div>
          </div>
          {mobileActionBar}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <AgendaExternalEvents dateStr={selectedDateStr} externalEventsByDate={externalEventsByDate} accountMap={accountMap} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} />
            <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
              addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
            <button onClick={() => handleOpenNewEvent(selectedDateStr)} className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors text-sm">
              <CalendarIcon className="w-4 h-4" /> Ajouter un événement
            </button>
          </div>
          {eventDialogElement}
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
            <button onClick={() => navigateMobile(-1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
            <button onClick={() => setSelectedDay(new Date())} className="px-2 py-1 text-xs hover:bg-muted rounded-md transition-colors font-medium text-foreground">Auj.</button>
            <button onClick={() => navigateMobile(1)} className="p-1.5 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-foreground" /></button>
          </div>
        </div>
        {mobileActionBar}
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
          <AgendaExternalEvents dateStr={selectedDateStr} externalEventsByDate={externalEventsByDate} accountMap={accountMap} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} />
          <AgendaTaskList dateStr={selectedDateStr} tasks={selectedDayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
            addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile />
            <button onClick={() => handleOpenNewEvent(selectedDateStr)} className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors text-sm">
              <CalendarIcon className="w-4 h-4" /> Ajouter un événement
            </button>
        </div>
        {eventDialogElement}
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // ─── Desktop layouts ───
  // ═══════════════════════════════════════════

  const sharedHeader = (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
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
              <button
                onClick={() => handleOpenNewEvent(toDateStr(currentDate))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Événement
              </button>
            </TooltipTrigger>
            <TooltipContent>Créer un événement</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => calSync.syncAllAccounts()}
                disabled={calSync.loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md hover:bg-muted transition-colors text-foreground disabled:opacity-50"
              >
                {calSync.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync
              </button>
            </TooltipTrigger>
            <TooltipContent>Synchroniser tous les agendas connectés</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={exportToICS} className="p-2 hover:bg-muted rounded-md transition-colors"><Download className="w-4 h-4 text-foreground/70" /></button>
            </TooltipTrigger>
            <TooltipContent>Exporter (.ics) – Google Agenda, Outlook, Apple…</TooltipContent>
          </Tooltip>
          <div className="flex gap-1">
            <button onClick={navigatePrev} className="p-2 hover:bg-muted rounded-md transition-colors"><ChevronLeft className="w-4 h-4 text-foreground" /></button>
            <button onClick={goToday} className="px-3 py-1.5 text-sm hover:bg-muted rounded-md transition-colors font-medium text-foreground">Aujourd'hui</button>
            <button onClick={navigateNext} className="p-2 hover:bg-muted rounded-md transition-colors"><ChevronRight className="w-4 h-4 text-foreground" /></button>
          </div>
        </div>
      </div>
      <CalendarAccountsManager
        accounts={calSync.accounts}
        syncing={calSync.syncing}
        onSync={(id) => calSync.syncAccount(id, 'pull')}
        onDelete={calSync.deleteAccount}
        onAddCalDav={calSync.addCalDavAccount}
        onAddIcs={calSync.addIcsAccount}
        onTestConnection={(id) => calSync.syncAccount(id, 'test') as Promise<boolean>}
      />
    </div>
  );

  // ─── Day view (desktop) ───
  if (mode === 'day') {
    return (
      <div className="p-6 h-full flex flex-col">
        {sharedHeader}
        <div className="flex-1 overflow-y-auto max-w-2xl">
          <AgendaExternalEvents dateStr={currentDateStr} externalEventsByDate={externalEventsByDate} accountMap={accountMap} onEditEvent={handleEditEvent} onDeleteEvent={handleDeleteEvent} />
          <AgendaTaskList dateStr={currentDateStr} tasks={dayTasks} allTasks={allTasks} teamMembers={teamMembers} setSelectedTaskId={setSelectedTaskId}
            addingForDate={addingForDate} setAddingForDate={setAddingForDate} newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle} handleAddTask={handleAddTask} isMobile={false} />
          <button onClick={() => handleOpenNewEvent(currentDateStr)} className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors text-sm">
            <CalendarIcon className="w-4 h-4" /> Ajouter un événement
          </button>
        </div>
        {eventDialogElement}
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
              const isTodayCell = ds === today;
              return (
                <div key={`hdr-${i}`} className={`py-2 text-center border-b border-r border-border ${isTodayCell ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <span className="text-xs font-semibold text-muted-foreground">{DAYS_FR[i]}</span>
                  <span className={`ml-1.5 text-xs font-bold ${isTodayCell ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full' : 'text-foreground'}`}>{d.getDate()}</span>
                </div>
              );
            })}
            {weekDays.map((d, i) => {
              const ds = toDateStr(d);
              const isTodayCell = ds === today;
              return (
                <DroppableDay key={`body-${i}`} dateStr={ds} isCurrentMonth={true} isToday={isTodayCell} dayNum={d.getDate()} onAddClick={() => setAddingForDate(ds)}>
                  {renderCellTasks(ds)}
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
            const isTodayCell = dateStr === today;
            return (
              <DroppableDay key={i} dateStr={dateStr} isCurrentMonth={day.isCurrentMonth} isToday={isTodayCell} dayNum={day.date.getDate()} onAddClick={() => setAddingForDate(dateStr)}>
                {renderCellTasks(dateStr, 3)}
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
      {eventDialogElement}
    </div>
  );
}
