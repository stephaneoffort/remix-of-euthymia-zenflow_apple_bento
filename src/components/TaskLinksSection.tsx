import React, { useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Link2, GitBranch, X, Plus, Lock, ExternalLink, Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/TaskBadges';
import { cn } from '@/lib/utils';

interface Props {
  taskId: string;
}

type Mode = 'link' | 'dependency' | null;

export default function TaskLinksSection({ taskId }: Props) {
  const {
    tasks,
    projects,
    spaces,
    lists,
    taskLinks,
    taskDependencies,
    addTaskLink,
    removeTaskLink,
    addTaskDependency,
    removeTaskDependency,
    setSelectedTaskId,
    getStatusLabel,
  } = useApp();

  const [mode, setMode] = useState<Mode>(null);
  const [pickedSpace, setPickedSpace] = useState<string>('');
  const [pickedProject, setPickedProject] = useState<string>('');
  const [pickedTask, setPickedTask] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const projectByList = useMemo(() => {
    const m = new Map<string, string>();
    lists.forEach(l => m.set(l.id, l.projectId));
    return m;
  }, [lists]);

  const links = useMemo(() => taskLinks.filter(l => l.taskId === taskId), [taskLinks, taskId]);
  const deps = useMemo(() => taskDependencies.filter(d => d.taskId === taskId), [taskDependencies, taskId]);

  const linkedTasks = useMemo(
    () => links.map(l => ({ link: l, task: tasks.find(t => t.id === l.linkedTaskId) })).filter(x => x.task),
    [links, tasks]
  );
  const depTasks = useMemo(
    () => deps.map(d => ({ dep: d, task: tasks.find(t => t.id === d.dependsOnId) })).filter(x => x.task),
    [deps, tasks]
  );

  const visibleSpaces = spaces.filter(s => !s.isArchived);
  const visibleProjects = projects.filter(p => !p.isArchived && (!pickedSpace || p.spaceId === pickedSpace));
  const projectListIds = new Set(lists.filter(l => l.projectId === pickedProject).map(l => l.id));
  const candidateTasks = tasks
    .filter(t => t.id !== taskId && (pickedProject ? projectListIds.has(t.listId) : true))
    .filter(t => !t.parentTaskId || pickedProject) // hide subtasks at root unless project chosen
    .sort((a, b) => a.title.localeCompare(b.title));

  const reset = () => {
    setMode(null);
    setPickedSpace('');
    setPickedProject('');
    setPickedTask('');
  };

  const handleAdd = async () => {
    if (!pickedTask || !mode) return;
    setSubmitting(true);
    try {
      if (mode === 'link') {
        await addTaskLink(taskId, pickedTask);
      } else {
        await addTaskDependency(taskId, pickedTask);
      }
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const taskLocation = (t: typeof tasks[0]) => {
    const projectId = projectByList.get(t.listId);
    const project = projects.find(p => p.id === projectId);
    const space = project ? spaces.find(s => s.id === project.spaceId) : null;
    return { project, space };
  };

  const renderTaskRow = (task: typeof tasks[0], onRemove: () => void, isBlocking?: boolean) => {
    const { project, space } = taskLocation(task);
    const isDone = task.status === 'done';
    return (
      <div
        key={task.id}
        className="group flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors"
      >
        {isBlocking && !isDone && <Lock className="w-3.5 h-3.5 text-priority-urgent shrink-0" />}
        {isBlocking && isDone && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
        <button
          onClick={() => setSelectedTaskId(task.id)}
          className="flex-1 min-w-0 text-left"
          title="Ouvrir la tâche"
        >
          <div className="flex items-center gap-1.5">
            {project && (
              <>
                <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                <span className="text-[11px] text-muted-foreground truncate">
                  {space?.name} · {project.name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-sm truncate', isDone ? 'text-muted-foreground line-through' : 'text-foreground')}>
              {task.title}
            </span>
            <StatusBadge status={task.status} />
          </div>
        </button>
        <ExternalLink className="w-3 h-3 text-foreground/45 opacity-60 group-hover:opacity-100 shrink-0 transition-opacity" />
        <button
          onClick={onRemove}
          className="p-0.5 opacity-60 group-hover:opacity-100 text-foreground/45 hover:text-destructive transition-all shrink-0"
          title="Retirer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  };

  const blockingCount = depTasks.filter(({ task }) => task && task.status !== 'done').length;

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
        <Link2 className="w-3 h-3" /> Liens & dépendances
        {blockingCount > 0 && (
          <span className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-priority-urgent/15 text-priority-urgent normal-case tracking-normal text-[10px] font-medium">
            <Lock className="w-3 h-3" />
            Bloquée par {blockingCount}
          </span>
        )}
      </label>

      {/* Dependencies */}
      {depTasks.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Dépend de
          </p>
          <div className="space-y-1.5">
            {depTasks.map(({ dep, task }) =>
              task ? renderTaskRow(task, () => removeTaskDependency(dep.id), true) : null
            )}
          </div>
        </div>
      )}

      {/* Reference links */}
      {linkedTasks.length > 0 && (
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> Tâches associées
          </p>
          <div className="space-y-1.5">
            {linkedTasks.map(({ link, task }) =>
              task ? renderTaskRow(task, () => removeTaskLink(link.id)) : null
            )}
          </div>
        </div>
      )}

      {/* Picker */}
      {mode ? (
        <div className="space-y-2 p-2.5 rounded-md border border-border bg-card/50">
          <p className="text-[11px] font-medium text-muted-foreground">
            {mode === 'link' ? 'Lier une tâche associée' : 'Ajouter une dépendance bloquante'}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <Select value={pickedSpace} onValueChange={(v) => { setPickedSpace(v); setPickedProject(''); setPickedTask(''); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Espace" /></SelectTrigger>
              <SelectContent>
                {visibleSpaces.map(s => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pickedProject} onValueChange={(v) => { setPickedProject(v); setPickedTask(''); }} disabled={!pickedSpace}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Projet" /></SelectTrigger>
              <SelectContent>
                {visibleProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={pickedTask} onValueChange={setPickedTask} disabled={!pickedProject}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tâche" /></SelectTrigger>
              <SelectContent>
                {candidateTasks.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title} {t.status === 'done' ? '✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={reset}>Annuler</Button>
            <Button size="sm" onClick={handleAdd} disabled={!pickedTask || submitting}>Ajouter</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button
            onClick={() => setMode('link')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Plus className="w-3 h-3" /> Lier une tâche
          </button>
          <button
            onClick={() => setMode('dependency')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <GitBranch className="w-3 h-3" /> Ajouter une dépendance
          </button>
        </div>
      )}
    </div>
  );
}
