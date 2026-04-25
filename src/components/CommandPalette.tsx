import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, FileText, FolderOpen, Tag, Hash, User } from 'lucide-react';
import { StatusCircle } from '@/components/TaskBadges';

interface CommandPaletteProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function CommandPalette({ externalOpen, onExternalOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { tasks, projects, spaces, teamMembers, setSelectedTaskId, setSelectedProjectId, setSelectedSpaceId, setQuickFilter, lists, setAdvancedFilters } = useApp();
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const items: { type: 'task' | 'project' | 'space' | 'member'; id: string; title: string; subtitle?: string; status?: string; avatarColor?: string }[] = [];

    // Search tasks (title, description, tags)
    for (const task of tasks) {
      if (items.length >= 20) break;
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q);
      const matchTags = task.tags.some(t => t.toLowerCase().includes(q));
      if (matchTitle || matchDesc || matchTags) {
        const list = lists.find(l => l.id === task.listId);
        const proj = list ? projects.find(p => p.id === list.projectId) : null;
        items.push({
          type: 'task',
          id: task.id,
          title: task.title,
          subtitle: proj?.name,
          status: task.status,
        });
      }
    }

    // Search projects
    for (const proj of projects) {
      if (items.length >= 25) break;
      if (proj.name.toLowerCase().includes(q)) {
        const space = spaces.find(s => s.id === proj.spaceId);
        items.push({
          type: 'project',
          id: proj.id,
          title: proj.name,
          subtitle: space?.name,
        });
      }
    }

    // Search spaces
    for (const space of spaces) {
      if (items.length >= 28) break;
      if (space.name.toLowerCase().includes(q)) {
        items.push({
          type: 'space',
          id: space.id,
          title: space.name,
          subtitle: `Espace`,
          spaceIconValue: space.icon,
        });
      }
    }

    // Search team members
    for (const member of teamMembers) {
      if (items.length >= 32) break;
      if (member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q)) {
        const assignedCount = tasks.filter(t => t.assigneeIds.includes(member.id)).length;
        items.push({
          type: 'member',
          id: member.id,
          title: member.name,
          subtitle: `${member.role} · ${assignedCount} tâche${assignedCount !== 1 ? 's' : ''}`,
          avatarColor: member.avatarColor,
        });
      }
    }

    return items;
  }, [query, tasks, projects, spaces, lists, teamMembers]);

  // Reset index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (item: typeof results[0]) => {
    setOpen(false);
    setQuery('');
    if (item.type === 'task') {
      setSelectedTaskId(item.id);
    } else if (item.type === 'project') {
      setSelectedProjectId(item.id);
      setQuickFilter('all');
      navigate('/');
    } else if (item.type === 'space') {
      setSelectedSpaceId(item.id);
      setSelectedProjectId(null);
      setQuickFilter('all');
      navigate('/');
    } else if (item.type === 'member') {
      // Filter tasks by this member
      setAdvancedFilters({ statuses: [], priorities: [], assigneeIds: [item.id], tags: [] });
      setSelectedProjectId(null);
      setSelectedSpaceId(null);
      setQuickFilter('all');
      navigate('/');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'task': return <FileText className="w-4 h-4 text-muted-foreground shrink-0" />;
      case 'project': return <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />;
      case 'space': return <Hash className="w-4 h-4 text-muted-foreground shrink-0" />;
      case 'member': return <User className="w-4 h-4 text-muted-foreground shrink-0" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(''); }}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden [&>button]:hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher des tâches, projets, espaces, membres…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-label font-medium text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun résultat pour « {query} »
            </p>
          )}
          {!query.trim() && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Tapez pour rechercher…
            </p>
          )}
          {results.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              {item.type === 'task' && item.status ? (
                <StatusCircle status={item.status} className="w-4 h-4 shrink-0" />
              ) : item.type === 'member' && item.avatarColor ? (
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-label font-bold text-primary-foreground shrink-0" style={{ backgroundColor: item.avatarColor }}>
                  {item.title.charAt(0).toUpperCase()}
                </div>
              ) : (
                typeIcon(item.type)
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                {item.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
                )}
              </div>
              <span className="text-label uppercase tracking-wider text-muted-foreground shrink-0">
                {item.type === 'task' ? 'Tâche' : item.type === 'project' ? 'Projet' : item.type === 'member' ? 'Membre' : 'Espace'}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
