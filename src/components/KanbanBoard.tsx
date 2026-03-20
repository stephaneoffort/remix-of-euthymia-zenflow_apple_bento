import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { PriorityBadge, AvatarGroup, SubtaskProgress } from '@/components/TaskBadges';
import { Plus, GripVertical, GripHorizontal, ChevronRight, ChevronsLeftRight, ChevronsRightLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-status-todo',
  in_progress: 'bg-status-progress',
  in_review: 'bg-status-review',
  done: 'bg-status-done',
  blocked: 'bg-status-blocked',
};

export default function KanbanBoard() {
  const { getFilteredTasks, moveTask, setSelectedTaskId, getMemberById, addTask, selectedProjectId, getListsForProject, tasks, allStatuses, getStatusLabel } = useApp();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>(allStatuses);
  const [dropTargetColumn, setDropTargetColumn] = useState<string | null>(null);
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
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
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTaskDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      moveTask(draggedTaskId, status);
      setDraggedTaskId(null);
    }
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
      <div
        key={status}
        className={`shrink-0 rounded-lg cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
          draggedColumn === status ? 'opacity-40 scale-[0.97]' : ''
        } ${dropTargetColumn === status && draggedColumn ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''
        } sm:flex sm:flex-col sm:items-center sm:py-3 sm:px-2 flex flex-row items-center gap-2 px-3 py-2.5 bg-muted/30 border border-border`}
        draggable
        onDragStart={e => handleColumnDragStart(e, status)}
        onDragEnd={handleColumnDragEnd}
        onDragOver={e => {
          e.preventDefault();
          if (draggedColumn) handleColumnDragOver(e, status);
        }}
        onDrop={e => {
          if (draggedColumn) handleColumnDrop(e, status);
          else handleTaskDrop(e, status);
        }}
        onDragLeave={() => { if (dropTargetColumn === status) setDropTargetColumn(null); }}
        onClick={() => toggleColumnCollapse(status)}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)} sm:mb-2 shrink-0`} />
        <span className="text-xs font-semibold text-foreground select-none sm:[writing-mode:vertical-lr] sm:rotate-180">
          {getStatusLabel(status)}
        </span>
        <span className="text-[10px] text-muted-foreground sm:mt-2 ml-auto sm:ml-0">{count}</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground sm:hidden shrink-0" />
      </div>
    );
  };

  const renderExpandedColumn = (status: string) => {
    const count = tasksByStatus[status]?.length || 0;
    return (
      <div
        key={status}
        className={`flex flex-col w-[85vw] sm:w-72 shrink-0 rounded-lg snap-center sm:snap-align-none transition-all duration-200 ${
          draggedColumn === status ? 'opacity-40 scale-[0.97]' : ''
        } ${dropTargetColumn === status && draggedColumn ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background' : ''}`}
        onDragOver={e => {
          e.preventDefault();
          if (draggedColumn) {
            handleColumnDragOver(e, status);
          }
        }}
        onDrop={e => {
          if (draggedColumn) {
            handleColumnDrop(e, status);
          } else {
            handleTaskDrop(e, status);
          }
        }}
        onDragLeave={() => {
          if (dropTargetColumn === status) setDropTargetColumn(null);
        }}
      >
        {/* Column header */}
        <div
          draggable
          onDragStart={e => handleColumnDragStart(e, status)}
          onDragEnd={handleColumnDragEnd}
          className="flex items-center gap-2 mb-3 px-1 group/header cursor-grab active:cursor-grabbing"
        >
          <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground/30 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 hidden sm:block" />
          <button
            onClick={e => { e.stopPropagation(); toggleColumnCollapse(status); }}
            className="p-0.5 hover:bg-muted rounded transition-colors"
            title="Réduire la colonne"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
          </button>
          <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
          <h3 className="font-semibold text-xs sm:text-sm text-foreground select-none">{getStatusLabel(status)}</h3>
          <span className="text-xs text-muted-foreground ml-1">{count}</span>
          <button
            onClick={() => setNewTaskStatus(status)}
            className="ml-auto p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Cards */}
        <div className="flex-1 space-y-2 overflow-y-auto scrollbar-thin">
          {(tasksByStatus[status] || []).map(task => {
            const subtasks = tasks.filter(t => t.parentTaskId === task.id);
            const doneSubtasks = subtasks.filter(t => t.status === 'done');
            const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';

            return (
              <div
                key={task.id}
                draggable
                onDragStart={e => handleTaskDragStart(e, task.id)}
                onDragEnd={() => setDraggedTaskId(null)}
                onClick={() => setSelectedTaskId(task.id)}
                className={`bg-card rounded-lg border p-2.5 sm:p-3 cursor-pointer hover:shadow-md transition-shadow group ${
                  draggedTaskId === task.id ? 'opacity-50' : ''
                } ${isOverdue ? 'border-l-2 border-l-priority-urgent' : ''}`}
              >
                <div className="flex items-start gap-1.5">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 mt-0.5 shrink-0 cursor-grab hidden sm:block" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-foreground leading-snug mb-1.5 sm:mb-2">{task.title}</p>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <PriorityBadge priority={task.priority} />
                      {task.dueDate && (
                        <span className={`text-[10px] sm:text-xs ${isOverdue ? 'text-priority-urgent font-medium' : 'text-muted-foreground'}`}>
                          {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                      <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 sm:mt-2">
                      <div className="flex gap-1 flex-wrap">
                        {task.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                      <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

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
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toggle all button */}
      <div className="flex justify-end px-3 sm:px-6 pt-2 sm:pt-4">
        <button
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title={allExpanded ? 'Tout réduire' : 'Tout déplier'}
        >
          {allExpanded ? <ChevronsRightLeft className="w-3.5 h-3.5" /> : <ChevronsLeftRight className="w-3.5 h-3.5" />}
          {allExpanded ? 'Tout réduire' : 'Tout déplier'}
        </button>
      </div>

      {/* Mobile: collapsed columns stacked vertically */}
      {isMobile && collapsedStatuses.length > 0 && (
        <div className="flex flex-col gap-1.5 px-3 pt-2">
          {collapsedStatuses.map(renderCollapsedColumn)}
        </div>
      )}

      {/* Main kanban area */}
      <div className={`flex gap-3 sm:gap-4 p-3 sm:p-6 overflow-x-auto flex-1 snap-x snap-mandatory sm:snap-none ${isMobile && collapsedStatuses.length > 0 ? 'pt-2' : ''}`}>
        {/* Desktop: show collapsed inline */}
        {!isMobile && collapsedStatuses.map(renderCollapsedColumn)}
        {/* Expanded columns */}
        {expandedStatuses.map(renderExpandedColumn)}
      </div>
    </div>
  );
}
