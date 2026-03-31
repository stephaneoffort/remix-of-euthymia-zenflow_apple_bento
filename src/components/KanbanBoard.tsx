import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types';
import { PriorityBadge, AvatarGroup, SubtaskProgress, ZenflowBadge, ZoomSessionBadge, MeetSessionBadge } from '@/components/TaskBadges';
import { useTaskMeetings } from '@/hooks/useTaskMeetings';
import { Plus, GripVertical, GripHorizontal, ChevronRight, ChevronsLeftRight, ChevronsRightLeft, Repeat, ArrowRightLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  in_review: 'bg-status-review',
  done: 'bg-status-done',
  blocked: 'bg-status-blocked',
};

export default function KanbanBoard() {
  const { getFilteredTasks, moveTask, setSelectedTaskId, getMemberById, addTask, selectedProjectId, selectedSpaceId, getListsForProject, tasks, allStatuses, getStatusLabel, getTasksForProject, projects, lists, quickFilter } = useApp();
  const { teamMemberId } = useAuth();
  const { zoomTaskIds, meetTaskIds } = useTaskMeetings();

  const getProjectName = useCallback((listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return null;
    const project = projects.find(p => p.id === list.projectId);
    return project || null;
  }, [lists, projects]);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(allStatuses);
  const [dropTargetColumn, setDropTargetColumn] = useState<string | null>(null);
  const [dropTargetTask, setDropTargetTask] = useState<string | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [mobileActiveStatus, setMobileActiveStatus] = useState<string>(allStatuses[0] || 'todo');
  const isMobile = useIsMobile();

  const toggleColumnCollapse = (status: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      next.has(status) ? next.delete(status) : next.add(status);
      return next;
    });
  };

  // Sync column order when allStatuses changes (new custom statuses added/removed)
  useEffect(() => {
    setColumnOrder(prev => {
      const existing = new Set(allStatuses);
      const kept = prev.filter(s => existing.has(s));
      const newOnes = allStatuses.filter(s => !kept.includes(s));
      return [...kept, ...newOnes];
    });
  }, [allStatuses]);

  const filteredTasks = getFilteredTasks();

  const tasksByStatus = columnOrder.reduce((acc, status) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  // Task drag handlers
  const handleTaskDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('type', 'task');
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      moveTask(draggedTaskId, status);
      setDraggedTaskId(null);
    }
    setDropTargetTask(null);
  };

  // Column drag handlers
  const handleColumnDragStart = (e: React.DragEvent, status: string) => {
    e.stopPropagation();
    setDraggedColumn(status);
    e.dataTransfer.setData('type', 'column');
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColumnDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== status) {
      setDropTargetColumn(status);
    }
  };

  const handleColumnDrop = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColumn && draggedColumn !== targetStatus) {
      setColumnOrder(prev => {
        const next = [...prev];
        const fromIdx = next.indexOf(draggedColumn);
        const toIdx = next.indexOf(targetStatus);
        if (fromIdx === -1 || toIdx === -1) return prev;
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, draggedColumn);
        return next;
      });
    }
    setDraggedColumn(null);
    setDropTargetColumn(null);
  }, [draggedColumn]);

  const handleColumnDragEnd = () => {
    setDraggedColumn(null);
    setDropTargetColumn(null);
  };

  const handleAddTask = (status: string) => {
    if (!newTaskTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || 'l1';
    addTask({
      title: newTaskTitle.trim(),
      description: '',
      status: status as any,
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: quickFilter === 'my_tasks' && teamMemberId ? [teamMemberId] : [],
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
    setNewTaskStatus(null);
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || 'bg-primary';
  };

  const collapsedStatuses = columnOrder.filter(s => collapsedColumns.has(s));
  const expandedStatuses = columnOrder.filter(s => !collapsedColumns.has(s));
  const allCollapsed = collapsedStatuses.length === columnOrder.length;
  const allExpanded = collapsedStatuses.length === 0;

  const toggleAll = () => {
    if (allExpanded) {
      setCollapsedColumns(new Set(columnOrder));
    } else {
      setCollapsedColumns(new Set());
    }
  };

  const renderCollapsedColumn = (status: string) => {
    const count = tasksByStatus[status]?.length || 0;
    return (
      <motion.button
        key={status}
        initial={{ opacity: 0, scale: 0.8, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer transition-colors duration-200 hover:bg-muted/60 bg-muted/30 border border-border text-xs ${
          draggedColumn === status ? 'opacity-40 scale-[0.97]' : ''
        } ${dropTargetColumn === status && draggedColumn ? 'ring-2 ring-primary/40' : ''}`}
        draggable
        onDragStart={e => handleColumnDragStart(e as unknown as React.DragEvent, status)}
        onDragEnd={handleColumnDragEnd}
        onDragOver={e => {
          e.preventDefault();
          if (draggedColumn) handleColumnDragOver(e as unknown as React.DragEvent, status);
        }}
        onDrop={e => {
          const de = e as unknown as React.DragEvent;
          if (draggedColumn) handleColumnDrop(de, status);
          else handleTaskDrop(de, status);
        }}
        onDragLeave={() => { if (dropTargetColumn === status) setDropTargetColumn(null); }}
        onClick={() => toggleColumnCollapse(status)}
      >
        <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} shrink-0`} />
        <span className="font-semibold text-foreground select-none whitespace-nowrap">
          {getStatusLabel(status)}
        </span>
        <span className="text-muted-foreground">{count}</span>
      </motion.button>
    );
  };

  const renderExpandedColumn = (status: string) => {
    const count = tasksByStatus[status]?.length || 0;
    const isTaskDropTarget = dropTargetTask === status && draggedTaskId && !draggedColumn;
    return (
      <motion.div
        key={status}
        layout
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`flex flex-col min-w-0 overflow-hidden rounded-lg snap-center sm:snap-align-none transition-all duration-200 ${
          draggedColumn === status ? 'opacity-40 scale-[0.97]' : ''
        } ${dropTargetColumn === status && draggedColumn ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          if (draggedColumn) {
            handleColumnDragOver(e, status);
          } else if (draggedTaskId) {
            setDropTargetTask(status);
          }
        }}
        onDrop={e => {
          if (draggedColumn) {
            handleColumnDrop(e, status);
          } else {
            handleTaskDrop(e, status);
          }
        }}
        onDragLeave={e => {
          if (dropTargetColumn === status) setDropTargetColumn(null);
          // Only clear if leaving the column entirely
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            setDropTargetTask(null);
          }
        }}
      >
        {/* Column header */}
        <div
          draggable
          onDragStart={e => handleColumnDragStart(e, status)}
          onDragEnd={handleColumnDragEnd}
          className="flex flex-col gap-1.5 mb-3 px-1 group/header cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 hidden sm:block" />
            <button
              onClick={e => { e.stopPropagation(); toggleColumnCollapse(status); }}
              className="p-0.5 hover:bg-muted rounded transition-colors"
              title="Réduire la colonne"
            >
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
            </button>
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
            <h3 className="font-semibold text-xs sm:text-sm text-foreground select-none truncate">{getStatusLabel(status)}</h3>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{count}/{filteredTasks.length}</span>
            <button
              onClick={() => setNewTaskStatus(status)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* Mini progress bar */}
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getStatusColor(status)}`}
              style={{ width: filteredTasks.length > 0 ? `${(count / filteredTasks.length) * 100}%` : '0%' }}
            />
          </div>
        </div>

        {/* Drop zone indicator */}
        <AnimatePresence>
          {isTaskDropTarget && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 40 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="mx-1 mb-2 rounded-lg border-2 border-dashed border-primary/50 bg-primary/5 flex items-center justify-center"
            >
              <span className="text-xs text-primary/70 font-medium">Déposer ici</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards */}
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
          <AnimatePresence mode="popLayout">
          {(tasksByStatus[status] || []).map(task => {
            const subtasks = tasks.filter(t => t.parentTaskId === task.id);
            const doneSubtasks = subtasks.filter(t => t.status === 'done');
            const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';

            return (
              <KanbanCard
                key={task.id}
                task={task}
                isMobile={isMobile}
                subtasks={subtasks}
                doneSubtasks={doneSubtasks}
                isOverdue={!!isOverdue}
                draggedTaskId={draggedTaskId}
                selectedProjectId={selectedProjectId}
                getProjectName={getProjectName}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
                allStatuses={allStatuses}
                moveTask={moveTask}
                setSelectedTaskId={setSelectedTaskId}
                setDraggedTaskId={setDraggedTaskId}
                handleTaskDragStart={handleTaskDragStart}
                getMemberById={getMemberById}
                zoomTaskIds={zoomTaskIds}
                meetTaskIds={meetTaskIds}
              />
            );
          })}
          </AnimatePresence>

          {/* Inline add task */}
          {newTaskStatus === status && (
            <div className="bg-card rounded-lg border p-2.5 sm:p-3">
              <input
                autoFocus
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddTask(status);
                  if (e.key === 'Escape') { setNewTaskStatus(null); setNewTaskTitle(''); }
                }}
                onBlur={() => { if (!newTaskTitle.trim()) { setNewTaskStatus(null); setNewTaskTitle(''); } }}
                placeholder="Titre de la tâche..."
                className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Project progress bar */}
      {selectedProjectId && (() => {
        const project = projects.find(p => p.id === selectedProjectId);
        const projectTasks = getTasksForProject(selectedProjectId);
        if (!project || projectTasks.length === 0) return null;
        const doneTasks = projectTasks.filter(t => t.status === 'done').length;
        const pct = Math.round((doneTasks / projectTasks.length) * 100);
        return (
          <div className="px-3 sm:px-6 pt-3 sm:pt-4 pb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              <span className="text-xs font-medium text-foreground">{project.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: project.color }}
                />
              </div>
              <span className="text-xs font-semibold tabular-nums text-foreground">{pct}%</span>
              <span className="text-label text-muted-foreground">{doneTasks}/{projectTasks.length}</span>
            </div>
          </div>
        );
      })()}

      {/* Toggle all button – desktop only */}
      {!isMobile && (
        <div className="flex justify-end px-6 pt-4">
          <button
            onClick={toggleAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            title={allExpanded ? 'Tout réduire' : 'Tout déplier'}
          >
            {allExpanded ? <ChevronsRightLeft className="w-3.5 h-3.5" /> : <ChevronsLeftRight className="w-3.5 h-3.5" />}
            {allExpanded ? 'Tout réduire' : 'Tout déplier'}
          </button>
        </div>
      )}

      {/* Collapsed columns shown as horizontal chips – desktop only */}
      {!isMobile && (
        <AnimatePresence>
          {collapsedStatuses.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="flex flex-wrap gap-1.5 px-3 pt-2 overflow-hidden"
            >
              <AnimatePresence mode="popLayout">
                {collapsedStatuses.map(renderCollapsedColumn)}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Main kanban area */}
      {isMobile ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Mobile status tabs */}
          <div className="flex gap-1 px-2 pt-2 pb-1 overflow-x-auto scrollbar-none">
            {columnOrder.map(status => {
              const count = tasksByStatus[status]?.length || 0;
              const isActive = mobileActiveStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => setMobileActiveStatus(status)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-primary-foreground/70' : getStatusColor(status)}`} />
                  {getStatusLabel(status)}
                  <span className={`ml-0.5 tabular-nums ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/60'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Active column content */}
          <div className="flex-1 overflow-y-auto p-2 pt-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={mobileActiveStatus}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                className="space-y-2"
              >
                {/* Add task button */}
                <button
                  onClick={() => setNewTaskStatus(mobileActiveStatus)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-border text-muted-foreground text-xs font-medium hover:bg-muted/40 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter une tâche
                </button>

                {/* Inline add task */}
                {newTaskStatus === mobileActiveStatus && (
                  <div className="bg-card rounded-lg border p-3">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTask(mobileActiveStatus);
                        if (e.key === 'Escape') { setNewTaskStatus(null); setNewTaskTitle(''); }
                      }}
                      onBlur={() => { if (!newTaskTitle.trim()) { setNewTaskStatus(null); setNewTaskTitle(''); } }}
                      placeholder="Titre de la tâche..."
                      className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                )}

                {/* Cards */}
                {(tasksByStatus[mobileActiveStatus] || []).map(task => {
                  const subtasks = tasks.filter(t => t.parentTaskId === task.id);
                  const doneSubtasks = subtasks.filter(t => t.status === 'done');
                  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';
                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isMobile={isMobile}
                      subtasks={subtasks}
                      doneSubtasks={doneSubtasks}
                      isOverdue={!!isOverdue}
                      draggedTaskId={draggedTaskId}
                      selectedProjectId={selectedProjectId}
                      getProjectName={getProjectName}
                      getStatusColor={getStatusColor}
                      getStatusLabel={getStatusLabel}
                      allStatuses={allStatuses}
                      moveTask={moveTask}
                      setSelectedTaskId={setSelectedTaskId}
                      setDraggedTaskId={setDraggedTaskId}
                      handleTaskDragStart={handleTaskDragStart}
                      getMemberById={getMemberById}
                      zoomTaskIds={zoomTaskIds}
                      meetTaskIds={meetTaskIds}
                    />
                  );
                })}

                {(tasksByStatus[mobileActiveStatus] || []).length === 0 && newTaskStatus !== mobileActiveStatus && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p className="text-sm">Aucune tâche</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className={`grid p-3 overflow-hidden flex-1 ${collapsedStatuses.length > 0 ? 'pt-1' : ''}`} style={{ gridTemplateColumns: `repeat(${expandedStatuses.length}, minmax(0, 1fr))`, gap: '0.5rem' }}>
          {expandedStatuses.map(renderExpandedColumn)}
        </div>
      )}
    </div>
  );
}

// Extracted card component with long-press support on mobile
function KanbanCard({
  task, isMobile, subtasks, doneSubtasks, isOverdue, draggedTaskId,
  selectedProjectId, getProjectName, getStatusColor, getStatusLabel,
  allStatuses, moveTask, setSelectedTaskId, setDraggedTaskId,
  handleTaskDragStart, getMemberById, zoomTaskIds, meetTaskIds,
}: {
  task: Task;
  isMobile: boolean;
  subtasks: Task[];
  doneSubtasks: Task[];
  isOverdue: boolean;
  draggedTaskId: string | null;
  selectedProjectId: string | null;
  getProjectName: (listId: string) => { name: string; color: string } | null;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  allStatuses: string[];
  moveTask: (taskId: string, status: string) => void;
  setSelectedTaskId: (id: string) => void;
  setDraggedTaskId: (id: string | null) => void;
  handleTaskDragStart: (e: React.DragEvent, taskId: string) => void;
  getMemberById: (id: string) => any;
  zoomTaskIds: Set<string>;
  meetTaskIds: Set<string>;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [pressing, setPressing] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const clearTimers = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (scaleTimer.current) { clearTimeout(scaleTimer.current); scaleTimer.current = null; }
    setPressing(false);
  }, []);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    // Start scale feedback after a short delay to avoid flicker on quick taps
    scaleTimer.current = setTimeout(() => setPressing(true), 120);
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setPressing(false);
      setMoveOpen(true);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => { clearTimers(); }, [clearTimers]);
  const handleTouchMove = useCallback(() => { clearTimers(); }, [clearTimers]);

  const handleClick = useCallback(() => {
    if (!didLongPress.current) {
      setSelectedTaskId(task.id);
    }
    didLongPress.current = false;
  }, [task.id, setSelectedTaskId]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      whileHover={{ y: -3, scale: 1.015, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      draggable={!isMobile}
      onDragStart={e => !isMobile && handleTaskDragStart(e as unknown as React.DragEvent, task.id)}
      onDragEnd={() => setDraggedTaskId(null)}
      onClick={handleClick}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onContextMenu={isMobile ? e => e.preventDefault() : undefined}
      className={`relative overflow-hidden bg-card rounded-md border p-1.5 sm:p-2 cursor-pointer group transition-shadow duration-200 hover:shadow-lg hover:shadow-primary/5 ${
        draggedTaskId === task.id ? 'opacity-50' : ''
      } ${isOverdue ? 'border-l-2 border-l-priority-urgent' : ''} ${moveOpen ? 'ring-2 ring-primary/40' : ''} ${pressing ? 'shadow-lg ring-2 ring-primary/30' : ''}`}
      style={{ willChange: 'transform' }}
    >
      {/* Liquid Glass shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-foreground/[0.03] via-transparent to-foreground/[0.02]" />
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-4 h-4 text-muted-foreground/60 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0 cursor-grab hidden sm:block" />
        <div className="flex-1 min-w-0">
          {!selectedProjectId && (() => {
            const proj = getProjectName(task.listId);
            return proj ? (
              <span className="text-label text-muted-foreground flex items-center gap-1 mb-1">
                <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: proj.color }} />
                {proj.name}
              </span>
            ) : null;
          })()}
          <p className="text-xs sm:text-sm font-medium text-foreground leading-snug mb-1.5 sm:mb-2">{task.title}</p>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <PriorityBadge priority={task.priority} />
            {task.dueDate && (
              <span className={`text-label sm:text-xs px-1.5 py-0.5 rounded bg-muted/50 transition-colors ${isOverdue ? 'text-priority-urgent font-medium' : 'text-foreground'}`}>
                {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
            <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
            <ZenflowBadge googleEventId={task.googleEventId} />
            <ZoomSessionBadge hasZoom={zoomTaskIds.has(task.id)} />
            <MeetSessionBadge hasMeet={!!task.googleEventId && meetTaskIds.has(task.googleEventId)} />
          </div>
          <div className="flex items-center justify-between mt-1.5 sm:mt-2">
            <div className="flex gap-1 flex-wrap items-center">
              {task.recurrence && (
                <span className="text-primary" title={`Récurrence : ${task.recurrence === 'daily' ? 'quotidien' : task.recurrence === 'weekly' ? 'hebdomadaire' : 'mensuel'}`}>
                  <Repeat className="w-3 h-3" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {isMobile && (
                <Popover open={moveOpen} onOpenChange={setMoveOpen}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={e => e.stopPropagation()}
                      className="p-1.5 -m-0.5 rounded-md bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors btn-icon-touch"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="end" onClick={e => e.stopPropagation()}>
                    <p className="text-xs font-semibold text-muted-foreground px-2.5 py-1.5">Déplacer vers…</p>
                    {allStatuses.filter(s => s !== task.status).map(s => (
                      <button
                        key={s}
                        onClick={e => {
                          e.stopPropagation();
                          moveTask(task.id, s);
                          setMoveOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-md text-sm hover:bg-muted transition-colors"
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(s)}`} />
                        {getStatusLabel(s)}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
              <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
