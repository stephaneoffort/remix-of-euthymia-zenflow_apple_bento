import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Status, Priority, STATUS_LABELS, PRIORITY_LABELS } from '@/types';
import { PriorityBadge, StatusBadge, AvatarGroup } from '@/components/TaskBadges';
import { X, ChevronRight, Plus, CheckCircle, Circle, MessageSquare, Sparkles, Clock, Paperclip, ChevronDown } from 'lucide-react';


export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTaskId, getTaskById, updateTask, getSubtasks, addTask, getTaskBreadcrumb, getMemberById, tasks, teamMembers } = useApp();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);

  if (!selectedTaskId) return null;
  const task = getTaskById(selectedTaskId);
  if (!task) return null;

  const breadcrumb = getTaskBreadcrumb(task.id);
  const subtasks = getSubtasks(task.id);
  const doneSubtasks = subtasks.filter(t => t.status === 'done');
  const allSubtasksDone = subtasks.length > 0 && doneSubtasks.length === subtasks.length;

  const handleAddSubtask = (parentId: string) => {
    if (!newSubtaskTitle.trim()) return;
    addTask({
      title: newSubtaskTitle.trim(),
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: parentId,
      listId: task.listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewSubtaskTitle('');
    setAddingSubtaskFor(null);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    updateTask(task.id, {
      comments: [...task.comments, {
        id: `c_${Date.now()}`,
        authorId: 'tm1',
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
      }],
    });
    setNewComment('');
  };

  const toggleSubtaskStatus = (subtaskId: string) => {
    const st = getTaskById(subtaskId);
    if (!st) return;
    updateTask(subtaskId, { status: st.status === 'done' ? 'todo' : 'done' });
  };

  return (
    <div className="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[520px] bg-card border-l border-border shadow-xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-x-auto">
          {breadcrumb.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
              <button
                onClick={() => setSelectedTaskId(t.id)}
                className={`truncate hover:text-foreground transition-colors whitespace-nowrap ${t.id === task.id ? 'text-foreground font-medium' : ''}`}
              >
                {t.title}
              </button>
            </React.Fragment>
          ))}
        </div>
        <button onClick={() => setSelectedTaskId(null)} className="p-1.5 hover:bg-muted rounded-md transition-colors shrink-0 ml-2">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-5 space-y-4 sm:space-y-6">
        {/* Title */}
        <input
          value={task.title}
          onChange={e => updateTask(task.id, { title: e.target.value })}
          className="text-base sm:text-lg font-bold text-foreground bg-transparent w-full outline-none border-none"
        />

        {/* Meta fields */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Statut</label>
            <select
              value={task.status}
              onChange={e => updateTask(task.id, { status: e.target.value as Status })}
              className="w-full text-sm bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Priorité</label>
            <select
              value={task.priority}
              onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
              className="w-full text-sm bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            >
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Date de début</label>
            <input
              type="date"
              value={task.startDate || ''}
              onChange={e => updateTask(task.id, { startDate: e.target.value || null })}
              className="w-full text-sm bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Échéance</label>
            <input
              type="date"
              value={task.dueDate || ''}
              onChange={e => updateTask(task.id, { dueDate: e.target.value || null })}
              className="w-full text-sm bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Assignees */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Assignée à</label>
          <div className="space-y-1">
            {teamMembers.map(m => (
              <label key={m.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={task.assigneeIds.includes(m.id)}
                  onChange={e => {
                    const ids = e.target.checked
                      ? [...task.assigneeIds, m.id]
                      : task.assigneeIds.filter(id => id !== m.id);
                    updateTask(task.id, { assigneeIds: ids });
                  }}
                  className="rounded border-border"
                />
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: m.avatarColor, color: 'white' }}>
                  {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <span className="truncate">{m.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
          <textarea
            value={task.description}
            onChange={e => updateTask(task.id, { description: e.target.value })}
            rows={3}
            placeholder="Ajouter une description..."
            className="w-full text-sm bg-muted/50 border border-border rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Tags</label>
          <div className="flex gap-1 flex-wrap">
            {task.tags.map(tag => (
              <span key={tag} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{tag}</span>
            ))}
            <input
              placeholder="+ tag"
              className="text-xs bg-transparent border-none outline-none w-16 placeholder:text-muted-foreground"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (!task.tags.includes(val)) {
                    updateTask(task.id, { tags: [...task.tags, val] });
                  }
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        </div>

        {/* Time */}
        <div className="flex gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Estimation (min)</label>
            <input type="number" value={task.timeEstimate || ''} onChange={e => updateTask(task.id, { timeEstimate: e.target.value ? parseInt(e.target.value) : null })} className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none" />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Temps passé (min)</label>
            <input type="number" value={task.timeLogged || ''} onChange={e => updateTask(task.id, { timeLogged: e.target.value ? parseInt(e.target.value) : null })} className="w-full text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none" />
          </div>
        </div>

        {/* AI Summary */}
        {task.aiSummary && (
          <div className="bg-accent/50 border border-accent rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground mb-1">
              <Sparkles className="w-3.5 h-3.5" /> Résumé IA
            </div>
            <p className="text-sm text-foreground">{task.aiSummary}</p>
          </div>
        )}

        {/* AI Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Résumé IA
          </button>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Sous-tâches IA
          </button>
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Sous-tâches
              {subtasks.length > 0 && <span className="text-muted-foreground">({doneSubtasks.length}/{subtasks.length})</span>}
            </label>
          </div>

          {allSubtasksDone && task.status !== 'done' && (
            <div className="bg-status-done/10 border border-status-done/30 rounded-lg p-2.5 mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span className="text-xs text-status-done font-medium">Toutes les sous-tâches terminées. Marquer comme terminée ?</span>
              <button
                onClick={() => updateTask(task.id, { status: 'done' })}
                className="text-xs bg-status-done text-primary-foreground px-2.5 py-1 rounded-md font-medium hover:opacity-90 shrink-0"
              >
                Terminer
              </button>
            </div>
          )}

          {subtasks.length > 0 && (
            <SubtaskTree taskId={task.id} depth={0} />
          )}

          {/* Add subtask inline */}
          {addingSubtaskFor === task.id ? (
            <div className="flex items-center gap-2 mt-2">
              <input
                autoFocus
                value={newSubtaskTitle}
                onChange={e => setNewSubtaskTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSubtask(task.id);
                  if (e.key === 'Escape') { setAddingSubtaskFor(null); setNewSubtaskTitle(''); }
                }}
                placeholder="Titre de la sous-tâche..."
                className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none"
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingSubtaskFor(task.id)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une sous-tâche
            </button>
          )}
        </div>

        {/* Comments */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 block">
            <MessageSquare className="w-3.5 h-3.5" /> Commentaires ({task.comments.length})
          </label>
          <div className="space-y-3 mb-3">
            {task.comments.map(c => {
              const author = getMemberById(c.authorId);
              return (
                <div key={c.id} className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ backgroundColor: author?.avatarColor || '#888', color: 'white' }}>
                    {author?.name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground truncate">{author?.name || 'Inconnu'}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5 break-words">{c.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
              placeholder="Écrire un commentaire..."
              className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none min-w-0"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50 shrink-0"
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SubtaskTree({ taskId, depth }: { taskId: string; depth: number }) {
  const { getSubtasks, getTaskById, updateTask, setSelectedTaskId, addTask, getMemberById } = useApp();
  const subtasks = getSubtasks(taskId);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(subtasks.map(s => s.id)));

  const parentTask = getTaskById(taskId);

  const handleAdd = (parentId: string) => {
    if (!newTitle.trim() || !parentTask) return;
    addTask({
      title: newTitle.trim(),
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: parentId,
      listId: parentTask.listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewTitle('');
    setAddingFor(null);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1" style={{ paddingLeft: depth > 0 ? `${Math.min(depth * 12, 36)}px` : '0' }}>
      {subtasks.map(st => {
        const children = getSubtasks(st.id);
        const hasChildren = children.length > 0;
        const isExpanded = expanded.has(st.id);

        return (
          <div key={st.id}>
            <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 px-1.5 sm:px-2 rounded-md hover:bg-muted/50 group transition-colors">
              {hasChildren ? (
                <button onClick={() => toggleExpand(st.id)} className="p-0.5 shrink-0">
                  {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              ) : <span className="w-4.5 shrink-0" />}
              <button onClick={() => updateTask(st.id, { status: st.status === 'done' ? 'todo' : 'done' })} className="shrink-0">
                {st.status === 'done'
                  ? <CheckCircle className="w-4 h-4 text-status-done" />
                  : <Circle className="w-4 h-4 text-muted-foreground hover:text-primary" />}
              </button>
              <button
                onClick={() => setSelectedTaskId(st.id)}
                className={`flex-1 text-left text-sm truncate ${st.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'} hover:text-primary transition-colors min-w-0`}
              >
                {st.title}
              </button>
              <div className="hidden sm:block">
                <AvatarGroup memberIds={st.assigneeIds} getMemberById={getMemberById} />
              </div>
              <button
                onClick={() => setAddingFor(st.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {addingFor === st.id && (
              <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: '28px' }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd(st.id);
                    if (e.key === 'Escape') { setAddingFor(null); setNewTitle(''); }
                  }}
                  onBlur={() => { if (!newTitle.trim()) { setAddingFor(null); setNewTitle(''); } }}
                  placeholder="Sous-tâche..."
                  className="flex-1 text-sm bg-muted/50 border border-border rounded-md px-2.5 py-1 outline-none min-w-0"
                />
              </div>
            )}

            {isExpanded && hasChildren && (
              <SubtaskTree taskId={st.id} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}
