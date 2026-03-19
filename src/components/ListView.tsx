import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PRIORITY_LABELS, Status, Priority } from '@/types';
import { PriorityBadge, StatusBadge, AvatarGroup, SubtaskProgress } from '@/components/TaskBadges';
import { ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type SortKey = 'title' | 'priority' | 'dueDate' | 'status';

const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'normal', 'low'];

export default function ListView() {
  const { getFilteredTasks, setSelectedTaskId, getMemberById, tasks } = useApp();
  const [sortKey, setSortKey] = useState<SortKey>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();

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
          <div
            className={`bg-card rounded-lg border p-3 ${isOverdue ? 'border-l-2 border-l-priority-urgent' : ''}`}
            style={{ marginLeft: `${depth * 12}px` }}
            onClick={() => setSelectedTaskId(task.id)}
          >
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
                <p className={`text-sm font-medium ${isOverdue ? 'text-priority-urgent' : 'text-foreground'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                  <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  {task.dueDate ? (
                    <span className={`text-xs ${isOverdue ? 'text-priority-urgent font-medium' : 'text-muted-foreground'}`}>
                      {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  ) : <span />}
                  <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
                </div>
              </div>
            </div>
          </div>
          {isExpanded && subtasks.map(st => renderCard(st, depth + 1))}
        </React.Fragment>
      );
    };

    return (
      <div className="p-3 overflow-auto h-full space-y-2">
        {sorted.map(task => renderCard(task))}
        {sorted.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">Aucune tâche trouvée</p>
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
        <tr
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
              <span className={`text-sm font-medium ${isOverdue ? 'text-priority-urgent' : 'text-foreground'}`}>{task.title}</span>
              <SubtaskProgress total={subtasks.length} done={doneSubtasks.length} />
            </div>
          </td>
          <td className="py-2.5 px-3"><StatusBadge status={task.status} /></td>
          <td className="py-2.5 px-3"><PriorityBadge priority={task.priority} /></td>
          <td className="py-2.5 px-3">
            <AvatarGroup memberIds={task.assigneeIds} getMemberById={getMemberById} />
          </td>
          <td className="py-2.5 px-3">
            {task.dueDate ? (
              <span className={`text-sm ${isOverdue ? 'text-priority-urgent font-medium' : 'text-muted-foreground'}`}>
                {new Date(task.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            ) : <span className="text-muted-foreground text-sm">—</span>}
          </td>
        </tr>
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
            {sorted.map(task => renderRow(task))}
            {sorted.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Aucune tâche trouvée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
