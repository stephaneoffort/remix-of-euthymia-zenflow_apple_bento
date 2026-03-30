import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { PRIORITY_LABELS, Status, Priority } from '@/types';
import { PriorityBadge, StatusBadge, AvatarGroup, SubtaskProgress, ZenflowBadge, ZoomSessionBadge, MeetSessionBadge } from '@/components/TaskBadges';
import { useTaskMeetings } from '@/hooks/useTaskMeetings';
import { ChevronRight, ChevronDown, ArrowUpDown, Plus, Repeat } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type SortKey = 'title' | 'priority' | 'dueDate' | 'status';

const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'normal', 'low'];

export default function ListView() {
  const { getFilteredTasks, setSelectedTaskId, getMemberById, tasks, addTask, selectedProjectId, getListsForProject, lists, projects, quickFilter } = useApp();
  const { teamMemberId } = useAuth();
  const { zoomTaskIds, meetTaskIds } = useTaskMeetings();
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const isMobile = useIsMobile();

  const getProjectForTask = (listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return null;
    return projects.find(p => p.id === list.projectId) || null;
  };

  const filteredTasks = getFilteredTasks();

  const sorted = [...filteredTasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'title': cmp = a.title.localeCompare(b.title); break;
      case 'priority': cmp = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority); break;
      case 'dueDate': cmp = (a.dueDate || '9').localeCompare(b.dueDate || '9'); break;
      case 'status': cmp = a.status.localeCompare(b.status); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const toggleExpand = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getSubtasks = (parentId: string) => tasks.filter(t => t.parentTaskId === parentId);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || 'l1';
    addTask({
      title: newTaskTitle.trim(),
      description: '',
      status: 'todo',
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
    setIsAdding(false);
  };

  // Mobile: card-based layout
  if (isMobile) {
    const renderCard = (task: typeof sorted[0], depth: number = 0) => {
      const subtasks = getSubtasks(task.id);
      const doneSubtasks = subtasks.filter(t => t.status === 'done');
      const hasChildren = subtasks.length > 0;
      const isExpanded = expandedTasks.has(task.id);
      const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';

      return (
        <React.Fragment key={task.id}>
          <motion.div
            layout
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
            whileHover={{ y: -2, scale: 1.01, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`relative overflow-hidden bg-card rounded-lg border p-3 cursor-pointer hover:shadow-md group ${isOverdue ? 'border-l-2 border-l-priority-urgent' : ''}`}
            style={{ marginLeft: `${depth * 12}px` }}
            onClick={() => setSelectedTaskId(task.id)}
          >
            <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            <div className="flex items-start gap-2">
              {hasChildren && (
                <button
                  onClick={e => { e.stopPropagation(); toggleExpand(task.id); }}
                  className="p-0.5 mt-0.5 shrink-0"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              )}
              <div className="flex-1 min-w-0">
                {!selectedProjectId && (() => {
                  const proj = getProjectForTask(task.listId);
                  return proj ? (
                    <span className="text-label text-muted-foreground flex items-center gap-1 mb-0.5">
                      <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: proj.color }} />
                      {proj.name}
                    </span>
                  ) : null;
                })()}
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-medium ${isOverdue ? 'text-priority-urgent' : 'text-foreground'}`}>{task.title}</p>
                  {task.recurrence && <Repeat className="w-3 h-3 text-primary shrink-0" />}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
                  <ZenflowBadge googleEventId={task.googleEventId} />
                  <ZoomSessionBadge hasZoom={zoomTaskIds.has(task.id)} />
                  <MeetSessionBadge hasMeet={!!task.googleEventId && meetTaskIds.has(task.googleEventId)} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {task.dueDate ? (
                    <span className={`text-xs px-1.5 py-0.5 rounded transition-colors dark:bg-muted dark:text-foreground dark:hover:bg-accent ${isOverdue ? 'text-priority-urgent font-medium' : 'text-foreground'}`}>
                      {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : <span />}
                  <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
                </div>
              </div>
            </div>
          </motion.div>
          {isExpanded && subtasks.map(st => renderCard(st, depth + 1))}
        </React.Fragment>
      );
    };

    return (
      <div className="p-3 overflow-auto h-full space-y-2">
        <AnimatePresence mode="popLayout">
        {sorted.map(task => renderCard(task))}
        </AnimatePresence>
        {sorted.length === 0 && !isAdding && (
          <EmptyState variant="list" onAction={() => setIsAdding(true)} />
        )}
        {isAdding ? (
          <div className="flex items-center gap-2 p-2 bg-card rounded-lg border border-border">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTask();
                if (e.key === 'Escape') { setIsAdding(false); setNewTaskTitle(''); }
              }}
              placeholder="Nom de la tâche..."
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
            />
            <button onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50">Ajouter</button>
            <button onClick={() => { setIsAdding(false); setNewTaskTitle(''); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Annuler</button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une tâche
          </button>
        )}
      </div>
    );
  }

  // Desktop: table layout
  const renderRow = (task: typeof sorted[0], depth: number = 0) => {
    const subtasks = getSubtasks(task.id);
    const doneSubtasks = subtasks.filter(t => t.status === 'done');
    const hasChildren = subtasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'done';

    return (
      <React.Fragment key={task.id}>
        <motion.tr
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="border-b border-border hover:bg-muted/50 transition-colors cursor-pointer group"
          onClick={() => setSelectedTaskId(task.id)}
        >
          <td className="py-2.5 px-3" style={{ paddingLeft: `${12 + depth * 24}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={e => { e.stopPropagation(); toggleExpand(task.id); }}
                  className="p-0.5 hover:bg-muted rounded"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </button>
              ) : <span className="w-5" />}
              <div className="flex flex-col min-w-0">
                {!selectedProjectId && (() => {
                  const proj = getProjectForTask(task.listId);
                  return proj ? (
                    <span className="text-label text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: proj.color }} />
                      {proj.name}
                    </span>
                  ) : null;
                })()}
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${isOverdue ? 'text-priority-urgent' : 'text-foreground'}`}>{task.title}</span>
                  {task.recurrence && <Repeat className="w-3 h-3 text-primary shrink-0" />}
                  <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
                  <ZenflowBadge googleEventId={task.googleEventId} />
                </div>
              </div>
            </div>
          </td>
          <td className="py-2.5 px-3"><StatusBadge status={task.status} /></td>
          <td className="py-2.5 px-3"><PriorityBadge priority={task.priority} /></td>
          <td className="py-2.5 px-3">
            <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
          </td>
          <td className="py-2.5 px-3">
            {task.dueDate ? (
              <span className={`text-sm px-1.5 py-0.5 rounded transition-colors dark:bg-muted dark:text-foreground dark:hover:bg-accent ${isOverdue ? 'text-priority-urgent font-medium' : 'text-foreground'}`}>
                {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            ) : <span className="text-foreground/40 text-sm">—</span>}
          </td>
        </motion.tr>
        {isExpanded && subtasks.map(st => renderRow(st, depth + 1))}
      </React.Fragment>
    );
  };

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <th
      className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none"
      onClick={() => toggleSort(sortKeyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="w-3 h-3" />
      </span>
    </th>
  );

  return (
    <div className="p-4 sm:p-6 overflow-auto h-full">
      <div className="bg-card rounded-lg border overflow-hidden">
        <table className="w-full">
          <thead className="border-b border-border bg-muted/30">
            <tr>
              <SortHeader label="Tâche" sortKeyName="title" />
              <SortHeader label="Statut" sortKeyName="status" />
              <SortHeader label="Priorité" sortKeyName="priority" />
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignée à</th>
              <SortHeader label="Échéance" sortKeyName="dueDate" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
            {sorted.map(task => renderRow(task))}
            </AnimatePresence>
            {sorted.length === 0 && !isAdding && (
              <tr><td colSpan={5}><EmptyState variant="list" onAction={() => setIsAdding(true)} /></td></tr>
            )}
            {isAdding ? (
              <tr className="border-b border-border">
                <td colSpan={5} className="py-2 px-3">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddTask();
                        if (e.key === 'Escape') { setIsAdding(false); setNewTaskTitle(''); }
                      }}
                      placeholder="Nom de la tâche..."
                      className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <button onClick={handleAddTask} disabled={!newTaskTitle.trim()} className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50">Ajouter</button>
                    <button onClick={() => { setIsAdding(false); setNewTaskTitle(''); }} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Annuler</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="py-1 px-3">
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter une tâche
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
