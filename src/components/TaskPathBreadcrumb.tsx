import { useApp } from '@/context/AppContext';
import { ChevronRight } from 'lucide-react';

interface Props {
  listId: string;
  /** Only render when a search is active (default true) */
  onlyWhenSearching?: boolean;
  className?: string;
}

/**
 * Shows the full location of a task: Espace → Projet → Liste.
 */
export default function TaskPathBreadcrumb({ listId, onlyWhenSearching = true, className }: Props) {
  const { lists, projects, spaces, searchQuery } = useApp();

  if (onlyWhenSearching && !searchQuery.trim()) return null;

  const list = lists.find(l => l.id === listId);
  const project = list ? projects.find(p => p.id === list.projectId) : null;
  const space = project ? spaces.find(s => s.id === project.spaceId) : null;

  const parts = [space?.name, project?.name, list?.name].filter(Boolean) as string[];
  if (parts.length === 0) return null;

  return (
    <p className={`flex items-center gap-0.5 flex-wrap text-[11px] text-muted-foreground min-w-0 ${className ?? ''}`}>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-60" />}
          <span className="truncate">{p}</span>
        </span>
      ))}
    </p>
  );
}
