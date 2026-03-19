import React from 'react';
import { useApp } from '@/context/AppContext';
import AppSidebar from '@/components/AppSidebar';
import KanbanBoard from '@/components/KanbanBoard';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import WorkloadView from '@/components/WorkloadView';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import TaskFilterBar from '@/components/TaskFilterBar';
import { useIsMobile } from '@/hooks/use-mobile';

import { Sparkles, PanelLeft } from 'lucide-react';

const QUICK_FILTER_TITLES: Record<string, string> = {
  all: '',
  my_tasks: 'Mes tâches',
  urgent: 'Tâches urgentes',
  today: "Tâches d'aujourd'hui",
  overdue: 'Tâches en retard',
};

export default function Index() {
  const { selectedProjectId, selectedView, quickFilter, selectedTaskId, projects, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const isMobile = useIsMobile();

  const project = projects.find(p => p.id === selectedProjectId);
  const title = quickFilter !== 'all'
    ? QUICK_FILTER_TITLES[quickFilter]
    : project?.name || 'Toutes les tâches';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card shrink-0">
          <div className="h-12 sm:h-14 flex items-center justify-between px-3 sm:px-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {sidebarCollapsed && isMobile && (
                <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
                  <PanelLeft className="w-5 h-5" />
                </button>
              )}
              {project && (
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              )}
              <h2 className="font-bold text-foreground text-sm sm:text-lg truncate">{title}</h2>
            </div>
            <button className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs sm:text-sm font-medium hover:bg-primary/20 transition-colors shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Analyser les priorités</span>
              <span className="sm:hidden">IA</span>
            </button>
          </div>
          <div className="px-3 sm:px-6 pb-2">
            <TaskFilterBar />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {selectedView === 'kanban' && <KanbanBoard />}
          {selectedView === 'list' && <ListView />}
          {selectedView === 'calendar' && <CalendarView />}
          {selectedView === 'workload' && <WorkloadView />}
        </main>
      </div>

      {/* Task detail panel */}
      {selectedTaskId && <TaskDetailPanel />}
    </div>
  );
}
  const { selectedProjectId, selectedView, quickFilter, selectedTaskId, projects, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const isMobile = useIsMobile();

  const project = projects.find(p => p.id === selectedProjectId);
  const title = quickFilter !== 'all'
    ? QUICK_FILTER_TITLES[quickFilter]
    : project?.name || 'Toutes les tâches';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card shrink-0">
          <div className="h-12 sm:h-14 flex items-center justify-between px-3 sm:px-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {sidebarCollapsed && isMobile && (
                <button onClick={() => setSidebarCollapsed(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
                  <PanelLeft className="w-5 h-5" />
                </button>
              )}
              {project && (
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
              )}
              <h2 className="font-bold text-foreground text-sm sm:text-lg truncate">{title}</h2>
            </div>
            <button className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs sm:text-sm font-medium hover:bg-primary/20 transition-colors shrink-0">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Analyser les priorités</span>
              <span className="sm:hidden">IA</span>
            </button>
          </div>
          <div className="px-3 sm:px-6 pb-2">
            <TaskFilterBar />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-hidden">
          {selectedView === 'kanban' && <KanbanBoard />}
          {selectedView === 'list' && <ListView />}
          {selectedView === 'calendar' && <CalendarView />}
        </main>
      </div>

      {/* Task detail panel */}
      {selectedTaskId && <TaskDetailPanel />}
    </div>
  );
}
