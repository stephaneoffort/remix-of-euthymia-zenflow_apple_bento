import React from 'react';
import { useApp } from '@/context/AppContext';
import AppSidebar from '@/components/AppSidebar';
import KanbanBoard from '@/components/KanbanBoard';
import ListView from '@/components/ListView';
import CalendarView from '@/components/CalendarView';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import { PROJECTS } from '@/data/sampleData';
import { Sparkles } from 'lucide-react';

const QUICK_FILTER_TITLES: Record<string, string> = {
  all: '',
  my_tasks: 'Mes tâches',
  urgent: 'Tâches urgentes',
  today: "Tâches d'aujourd'hui",
  overdue: 'Tâches en retard',
};

export default function Index() {
  const { selectedProjectId, selectedView, quickFilter, selectedTaskId } = useApp();

  const project = PROJECTS.find(p => p.id === selectedProjectId);
  const title = quickFilter !== 'all'
    ? QUICK_FILTER_TITLES[quickFilter]
    : project?.name || 'Toutes les tâches';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center justify-between px-6 bg-card shrink-0">
          <div className="flex items-center gap-3">
            {project && (
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: project.color }} />
            )}
            <h2 className="font-bold text-foreground text-lg">{title}</h2>
          </div>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
            <Sparkles className="w-4 h-4" /> Analyser les priorités
          </button>
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
