import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import AppSidebar from '@/components/AppSidebar';
import KanbanBoard from '@/components/KanbanBoard';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import WorkloadView from '@/components/WorkloadView';
import MindMapView from '@/components/MindMapView';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import TaskFilterBar from '@/components/TaskFilterBar';
import MobileBottomNav from '@/components/MobileBottomNav';
import TaskSuggestions from '@/components/TaskSuggestions';
import AIChatPanel from '@/components/AIChatPanel';
import { useIsMobile } from '@/hooks/use-mobile';
import { ViewType } from '@/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { Sparkles, PanelLeft, Filter, ChevronDown, ChevronUp, LayoutGrid, List, Calendar, BarChart3, GitFork } from 'lucide-react';

const VIEW_OPTIONS: { key: ViewType; label: string; icon: React.ReactNode }[] = [
  { key: 'kanban', label: 'Kanban', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'list', label: 'Liste', icon: <List className="w-4 h-4" /> },
  { key: 'calendar', label: 'Calendrier', icon: <Calendar className="w-4 h-4" /> },
  { key: 'workload', label: 'Charge', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'mindmap', label: 'Carte', icon: <GitFork className="w-4 h-4" /> },
];

const QUICK_FILTER_TITLES: Record<string, string> = {
  all: '',
  my_tasks: 'Mes tâches',
  urgent: 'Tâches urgentes',
  today: "Tâches d'aujourd'hui",
  overdue: 'Tâches en retard',
};

export default function Index() {
  const { selectedProjectId, selectedSpaceId, selectedView, setSelectedView, quickFilter, selectedTaskId, projects, spaces, sidebarCollapsed, setSidebarCollapsed, advancedFilters } = useApp();
  const isMobile = useIsMobile();
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const project = projects.find(p => p.id === selectedProjectId);
  const space = spaces.find(s => s.id === selectedSpaceId);
  const title = quickFilter !== 'all'
    ? QUICK_FILTER_TITLES[quickFilter]
    : project?.name || space?.name || 'Toutes les tâches';

  const hasActiveFilters =
    advancedFilters.statuses.length > 0 ||
    advancedFilters.priorities.length > 0 ||
    advancedFilters.assigneeIds.length > 0 ||
    advancedFilters.tags.length > 0;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card shrink-0">
          <div className="h-12 sm:h-14 flex items-center justify-between px-3 sm:px-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {sidebarCollapsed && !isMobile && (
                <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
                  <PanelLeft className="w-5 h-5" />
                </button>
              )}
              {project && (
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              )}
              <h2 className="font-bold text-foreground text-sm sm:text-lg truncate">{title}</h2>
              {/* View selector */}
              <div className="hidden sm:flex items-center gap-0.5 ml-2 bg-muted/50 rounded-lg p-0.5">
                {VIEW_OPTIONS.map(v => (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedView(v.key)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          selectedView === v.key
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {v.icon}
                        <span className="hidden lg:inline">{v.label}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="lg:hidden">
                      {v.label}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Mobile filter toggle */}
              {isMobile && (
                <button
                  onClick={() => setFiltersVisible(!filtersVisible)}
                  className={`relative inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    hasActiveFilters
                      ? 'border-primary/30 bg-primary/5 text-primary'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  {hasActiveFilters && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                      {advancedFilters.statuses.length + advancedFilters.priorities.length + advancedFilters.assigneeIds.length + advancedFilters.tags.length}
                    </span>
                  )}
                  {filtersVisible ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              <button
                onClick={() => setSuggestionsOpen(true)}
                className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs sm:text-sm font-medium hover:bg-primary/20 transition-colors shrink-0 active:scale-[0.97]"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Suggestions IA</span>
                <span className="sm:hidden">IA</span>
              </button>
            </div>
          </div>
          {/* Filters - always visible on desktop, collapsible on mobile */}
          {(!isMobile || filtersVisible) && (
            <div className="px-3 sm:px-6 pb-2">
              <TaskFilterBar />
            </div>
          )}
        </header>

        {/* Main content - add bottom padding on mobile for nav bar */}
        <main className={`flex-1 overflow-hidden ${isMobile ? 'pb-14' : ''}`}>
          {selectedView === 'kanban' && <KanbanBoard />}
          {selectedView === 'list' && <ListView />}
          {selectedView === 'calendar' && <CalendarView />}
          {selectedView === 'workload' && <WorkloadView />}
          {selectedView === 'mindmap' && <MindMapView />}
        </main>
      </div>

      {/* Task detail panel */}
      {selectedTaskId && <TaskDetailPanel />}

      {/* AI components */}
      <TaskSuggestions open={suggestionsOpen} onClose={() => setSuggestionsOpen(false)} />
      <AIChatPanel />

      {/* Mobile bottom navigation */}
      {isMobile && !selectedTaskId && <MobileBottomNav />}
    </div>
  );
}
