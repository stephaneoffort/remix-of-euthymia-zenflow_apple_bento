import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { StatusCircle } from '@/components/TaskBadges';
import SpaceIcon from '@/components/SpaceIcon';

const GLOBAL_SEARCH_EVENT = 'zenflow:global-task-search';

/** Ouvre la recherche globale des tâches depuis n'importe où dans l'application. */
export function openGlobalTaskSearch() {
  window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_EVENT));
}

const ALL = '__all__';

export default function GlobalTaskSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [spaceId, setSpaceId] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [listId, setListId] = useState<string>(ALL);

  const navigate = useNavigate();
  const {
    tasks, spaces, projects, lists,
    setSelectedTaskId, setSelectedSpaceId, setSelectedProjectId, setQuickFilter,
    getStatusLabel,
  } = useApp();

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const keyHandler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(GLOBAL_SEARCH_EVENT, openHandler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener(GLOBAL_SEARCH_EVENT, openHandler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, []);

  // Projets disponibles selon l'espace choisi
  const availableProjects = useMemo(
    () => (spaceId === ALL ? projects : projects.filter((p) => p.spaceId === spaceId)),
    [projects, spaceId],
  );

  // Listes disponibles selon le projet (ou l'espace) choisi
  const availableLists = useMemo(() => {
    const projIds = new Set(
      (projectId === ALL ? availableProjects : availableProjects.filter((p) => p.id === projectId)).map((p) => p.id),
    );
    return lists.filter((l) => projIds.has(l.projectId));
  }, [lists, availableProjects, projectId]);

  // Réinitialise les filtres dépendants
  useEffect(() => {
    if (projectId !== ALL && !availableProjects.some((p) => p.id === projectId)) setProjectId(ALL);
  }, [availableProjects, projectId]);
  useEffect(() => {
    if (listId !== ALL && !availableLists.some((l) => l.id === listId)) setListId(ALL);
  }, [availableLists, listId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const allowedListIds = new Set(availableLists.map((l) => l.id));

    return tasks
      .filter((t) => {
        if (listId !== ALL) return t.listId === listId;
        return allowedListIds.has(t.listId);
      })
      .filter((t) => {
        if (!q) return true;
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
      .slice(0, 80)
      .map((t) => {
        const list = lists.find((l) => l.id === t.listId);
        const proj = list ? projects.find((p) => p.id === list.projectId) : null;
        const space = proj ? spaces.find((s) => s.id === proj.spaceId) : null;
        return { task: t, list, proj, space };
      });
  }, [tasks, query, listId, availableLists, lists, projects, spaces]);

  const hasFilter = spaceId !== ALL || projectId !== ALL || listId !== ALL;

  const resetFilters = () => {
    setSpaceId(ALL);
    setProjectId(ALL);
    setListId(ALL);
  };

  const handleSelect = (taskId: string, projId?: string, spId?: string) => {
    setOpen(false);
    setQuery('');
    setQuickFilter('all');
    if (spId) setSelectedSpaceId(spId);
    if (projId) setSelectedProjectId(projId);
    setSelectedTaskId(taskId);
    navigate('/');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden bg-popover text-popover-foreground">
        <DialogTitle className="sr-only">Recherche globale des tâches</DialogTitle>
        <DialogDescription className="sr-only">
          Rechercher une tâche dans toute l'application, avec filtres par espace, projet et liste.
        </DialogDescription>

        {/* Champ de recherche */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une tâche (titre, description, étiquette)…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Filtres espace / projet / liste */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border">
          <Select value={spaceId} onValueChange={setSpaceId}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Espace" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              <SelectItem value={ALL}>Tous les espaces</SelectItem>
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <SpaceIcon icon={s.icon} className="w-3.5 h-3.5" />
                    {s.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Projet" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              <SelectItem value={ALL}>Tous les projets</SelectItem>
              {availableProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={listId} onValueChange={setListId}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Liste" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground">
              <SelectItem value={ALL}>Toutes les listes</SelectItem>
              {availableLists.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              Réinitialiser
            </button>
          )}

          <span data-numeric className="ml-auto font-numeric tabular-nums text-xs text-muted-foreground">
            {results.length} résultat{results.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Résultats */}
        <div className="max-h-96 overflow-y-auto py-2">
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Aucune tâche ne correspond à cette recherche.
            </p>
          )}
          {results.map(({ task, list, proj, space }) => (
            <button
              key={task.id}
              onClick={() => handleSelect(task.id, proj?.id, space?.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"
            >
              <StatusCircle status={task.status} className="w-4 h-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[space?.name, proj?.name, list?.name].filter(Boolean).join(' › ')}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{getStatusLabel(task.status)}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
