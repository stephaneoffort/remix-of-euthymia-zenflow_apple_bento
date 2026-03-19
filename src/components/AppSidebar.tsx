import React, { useState } from 'react';
import { ChevronRight, ChevronDown, LayoutGrid, List, Calendar, AlertCircle, Clock, User, Flame, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { QuickFilter, ViewType } from '@/types';

const QUICK_FILTERS: { key: QuickFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Toutes les tâches', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'my_tasks', label: 'Mes tâches', icon: <User className="w-4 h-4" /> },
  { key: 'urgent', label: 'Urgentes', icon: <Flame className="w-4 h-4" /> },
  { key: 'today', label: "Aujourd'hui", icon: <Clock className="w-4 h-4" /> },
  { key: 'overdue', label: 'En retard', icon: <AlertCircle className="w-4 h-4" /> },
];

const VIEW_OPTIONS: { key: ViewType; label: string; icon: React.ReactNode }[] = [
  { key: 'kanban', label: 'Kanban', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'list', label: 'Liste', icon: <List className="w-4 h-4" /> },
  { key: 'calendar', label: 'Calendrier', icon: <Calendar className="w-4 h-4" /> },
];

export default function AppSidebar() {
  const {
    spaces, selectedProjectId, setSelectedProjectId,
    selectedView, setSelectedView, quickFilter, setQuickFilter,
    getProjectsForSpace, teamMembers, sidebarCollapsed, setSidebarCollapsed,
    tasks,
  } = useApp();

  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(spaces.map(s => s.id)));

  const toggleSpace = (id: string) => {
    setExpandedSpaces(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const overdueCount = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate && t.dueDate < today && t.status !== 'done';
  }).length;

  if (sidebarCollapsed) {
    return (
      <div className="w-12 bg-sidebar-bg flex flex-col items-center py-3 border-r border-sidebar-border-color shrink-0">
        <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors">
          <PanelLeft className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 bg-sidebar-bg flex flex-col border-r border-sidebar-border-color shrink-0 h-screen">
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-sidebar-border-color">
        <div>
          <h1 className="text-sidebar-fg-bright font-bold text-lg leading-tight">🧘 Euthymia</h1>
          <p className="text-sidebar-fg text-xs">Gestion de projets</p>
        </div>
        <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors">
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Views */}
      <div className="px-3 py-3 border-b border-sidebar-border-color">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider px-2 mb-2">Vues</p>
        <div className="flex gap-1">
          {VIEW_OPTIONS.map(v => (
            <button
              key={v.key}
              onClick={() => setSelectedView(v.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedView === v.key
                  ? 'bg-sidebar-active text-sidebar-fg-bright'
                  : 'text-sidebar-fg hover:bg-sidebar-hover'
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Filters */}
      <div className="px-3 py-3 border-b border-sidebar-border-color">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider px-2 mb-2">Filtres</p>
        {QUICK_FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => {
              setQuickFilter(f.key);
              if (f.key !== 'all') setSelectedProjectId(null);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              quickFilter === f.key && !selectedProjectId
                ? 'bg-sidebar-active text-sidebar-fg-bright'
                : 'text-sidebar-fg hover:bg-sidebar-hover'
            }`}
          >
            {f.icon}
            {f.label}
            {f.key === 'overdue' && overdueCount > 0 && (
              <span className="ml-auto text-xs bg-priority-urgent text-sidebar-fg-bright rounded-full px-1.5 py-0.5">{overdueCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Spaces & Projects */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider px-2 mb-2">Espaces</p>
        {spaces.map(space => (
          <div key={space.id} className="mb-1">
            <button
              onClick={() => toggleSpace(space.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
            >
              {expandedSpaces.has(space.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>{space.icon}</span>
              <span className="font-medium">{space.name}</span>
            </button>
            {expandedSpaces.has(space.id) && (
              <div className="ml-4">
                {getProjectsForSpace(space.id).map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setQuickFilter('all');
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                      selectedProjectId === project.id
                        ? 'bg-sidebar-active text-sidebar-fg-bright'
                        : 'text-sidebar-fg hover:bg-sidebar-hover'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Team */}
      <div className="px-4 py-3 border-t border-sidebar-border-color">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider mb-2">Équipe</p>
        <div className="flex gap-1 flex-wrap">
          {teamMembers.map(m => (
            <div
              key={m.id}
              title={`${m.name} — ${m.role}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
              style={{ backgroundColor: m.avatarColor, color: 'white' }}
            >
              {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
