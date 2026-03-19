import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FR_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_FR_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-muted text-muted-foreground',
};

function DraggableTask({ task, onClick, members }: { task: Task; onClick: () => void; members: { id: string; name: string; avatarColor: string }[] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const assignees = members.filter(m => task.assigneeIds.includes(m.id));

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`text-[9px] sm:text-[11px] px-1 sm:px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate cursor-grab hover:bg-primary/20 transition-colors ${
            isDragging ? 'opacity-30' : ''
          }`}
        >
          {task.title}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-64 p-3 space-y-2 text-xs z-50">
        <p className="font-semibold text-sm text-foreground leading-tight">{task.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal}`}>
            {PRIORITY_LABELS[task.priority] || task.priority}
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
            {task.status === 'todo' ? 'À faire' : task.status === 'in_progress' ? 'En cours' : task.status === 'in_review' ? 'En revue' : task.status === 'done' ? 'Terminé' : task.status}
          </span>
        </div>
        {assignees.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Assigné :</span>
            <div className="flex items-center gap-1">
              {assignees.map(a => (
                <span key={a.id} className="inline-flex items-center gap-1">
                  <span className="w-4 h-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center" style={{ backgroundColor: a.avatarColor }}>
                    {a.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-foreground">{a.name.split(' ')[0]}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
        {task.dueDate && (
          <p className="text-muted-foreground">Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

function DroppableDay({ dateStr, isCurrentMonth, isToday, dayNum, children, isMobile, onAddClick }: {
  dateStr: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  dayNum: number;
  children: React.ReactNode;
  isMobile: boolean;
  onAddClick: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: dateStr });

  return (
    <div
      ref={setNodeRef}
      className={`group min-h-[48px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-border transition-colors ${
        isCurrentMonth ? 'bg-card' : 'bg-muted/20'
      } ${isOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[10px] sm:text-xs font-medium inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-full ${
          isToday ? 'bg-primary text-primary-foreground' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50'
        }`}>
          {dayNum}
        </span>
        {isCurrentMonth && !isMobile && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddClick(); }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
            title="Ajouter une tâche"
          >
            <Plus className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
      <div className="mt-0.5 sm:mt-1 space-y-0.5">
        {children}
      </div>
    </div>
  );
}

export default function CalendarView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, updateTask, selectedProjectId, getListsForProject } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  const activeTask = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTaskId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newDate = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (task && task.dueDate !== newDate) {
      updateTask(taskId, { dueDate: newDate });
    }
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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 border border-border rounded-lg overflow-hidden flex-1">
          {dayLabels.map((d, i) => (
            <div key={i} className="py-1 sm:py-2 text-center text-[10px] sm:text-xs font-semibold text-muted-foreground bg-muted/30 border-b border-border">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const dateStr = day.date.toISOString().split('T')[0];
            const dayTasks = tasksByDate.get(dateStr) || [];
            const isToday = dateStr === today;

            return (
              <DroppableDay
                key={i}
                dateStr={dateStr}
                isCurrentMonth={day.isCurrentMonth}
                isToday={isToday}
                dayNum={day.date.getDate()}
                isMobile={isMobile}
                onAddClick={() => setAddingForDate(dateStr)}
              >
                {dayTasks.slice(0, maxTasks).map(t => (
                  <DraggableTask
                    key={t.id}
                    task={t}
                    onClick={() => setSelectedTaskId(t.id)}
                  />
                ))}
                {dayTasks.length > maxTasks && (
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground px-1">+{dayTasks.length - maxTasks}</span>
                )}
                {addingForDate === dateStr && (
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddTask(dateStr);
                      if (e.key === 'Escape') { setAddingForDate(null); setNewTaskTitle(''); }
                    }}
                    onBlur={() => { if (newTaskTitle.trim()) handleAddTask(dateStr); else { setAddingForDate(null); setNewTaskTitle(''); } }}
                    placeholder="Tâche..."
                    className="w-full text-[10px] sm:text-[11px] px-1 py-0.5 rounded border border-primary/40 bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </DroppableDay>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="text-[11px] px-1.5 py-0.5 rounded bg-primary/20 text-primary shadow-lg border border-primary/30 max-w-[150px] truncate">
              {activeTask.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
