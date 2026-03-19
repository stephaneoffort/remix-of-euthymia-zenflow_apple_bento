import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Task, DEFAULT_STATUSES } from '@/types';
import { PriorityBadge, AvatarGroup, SubtaskProgress } from '@/components/TaskBadges';
import { Plus, GripVertical } from 'lucide-react';

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
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const filteredTasks = getFilteredTasks();

  const tasksByStatus = allStatuses.reduce((acc, status) => {
    acc[status] = filteredTasks.filter(t => t.status === status);
    return acc;
  }, {} as Record<string, Task[]>);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (draggedTaskId) {
      moveTask(draggedTaskId, status);
      setDraggedTaskId(null);
    }
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

  return (
    <div className="flex gap-3 sm:gap-4 p-3 sm:p-6 overflow-x-auto h-full">
      {allStatuses.map(status => (
        <div
          key={status}
          className="flex flex-col w-60 sm:w-72 shrink-0"
          onDragOver={e => e.preventDefault()}
          onDrop={e => handleDrop(e, status)}
        >
          {/* Column header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(status)}`} />
            <h3 className="font-semibold text-xs sm:text-sm text-foreground">{getStatusLabel(status)}</h3>
            <span className="text-xs text-muted-foreground ml-1">{tasksByStatus[status]?.length || 0}</span>
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
                  onDragStart={e => handleDragStart(e, task.id)}
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
      ))}
    </div>
  );
}
