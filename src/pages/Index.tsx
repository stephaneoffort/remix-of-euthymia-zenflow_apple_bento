import DashboardView from "@/components/DashboardView";
import VoiceTaskCreator from "@/components/VoiceTaskCreator";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import KanbanBoard from "@/components/KanbanBoard";
import ListView from "@/components/ListView";
import CalendarView from "@/components/CalendarView";
import WorkloadView from "@/components/WorkloadView";
import MindMapView from "@/components/MindMapView";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import TaskFilterBar from "@/components/TaskFilterBar";
import MobileBottomNav from "@/components/MobileBottomNav";
import TaskSuggestions from "@/components/TaskSuggestions";
import AIChatPanel from "@/components/AIChatPanel";
import CommandPalette from "@/components/CommandPalette";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { ViewType } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";

import {
  Sparkles,
  PanelLeft,
  Filter,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  LayoutGrid,
  List,
  Calendar,
  BarChart3,
  Network,
  Search,
  X,
  Keyboard,
  Mic,
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";

const VIEW_OPTIONS: { key: ViewType; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "kanban", label: "Kanban", icon: <LayoutGrid className="w-4 h-4" /> },
  { key: "list", label: "Liste", icon: <List className="w-4 h-4" /> },
  { key: "calendar", label: "Calendrier", icon: <Calendar className="w-4 h-4" /> },
  { key: "workload", label: "Charge", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "mindmap", label: "Carte mentale", icon: <Network className="w-4 h-4" /> },
];

const QUICK_FILTER_TITLES: Record<string, string> = {
  all: "",
  my_tasks: "Mes tâches",
  urgent: "Tâches urgentes",
  today: "Tâches d'aujourd'hui",
  overdue: "Tâches en retard",
};

export default function Index() {
  const {
    selectedProjectId,
    selectedSpaceId,
    selectedView,
    setSelectedView,
    quickFilter,
    selectedTaskId,
    setSelectedTaskId,
    projects,
    spaces,
    teamMembers,
    sidebarCollapsed,
    setSidebarCollapsed,
    advancedFilters,
    setAdvancedFilters,
    setSelectedProjectId,
    setSelectedSpaceId,
    setQuickFilter,
    addTask,
    getListsForProject,
  } = useApp();
  const { teamMemberId } = useAuth();
  const isMobile = useIsMobile();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTitle, setQuickAddTitle] = useState("");
  const [voiceAddOpen, setVoiceAddOpen] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: useCallback(() => setQuickAddOpen(true), []),
    onClosePanel: useCallback(() => {
      if (selectedTaskId) setSelectedTaskId(null);
    }, [selectedTaskId, setSelectedTaskId]),
    onOpenSearch: useCallback(() => setSearchOpen(true), []),
    onToggleHelp: useCallback(() => setShortcutsOpen((prev) => !prev), []),
  });

  const handleQuickAdd = () => {
    if (!quickAddTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || "l1";
    addTask({
      title: quickAddTitle.trim(),
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: null,
      startDate: null,
      assigneeIds: quickFilter === 'my_tasks' && teamMemberId ? [teamMemberId] : [],
      tags: [],
      parentTaskId: null,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setQuickAddTitle("");
    setQuickAddOpen(false);
  };

  const filterCount =
    advancedFilters.statuses.length +
    advancedFilters.priorities.length +
    advancedFilters.assigneeIds.length +
    advancedFilters.tags.length;

  const project = projects.find((p) => p.id === selectedProjectId);
  const parentSpace = project ? spaces.find((s) => s.id === project.spaceId) : null;
  const space = spaces.find((s) => s.id === selectedSpaceId);

  const isQuickFilter = quickFilter !== "all";
  const title = isQuickFilter ? QUICK_FILTER_TITLES[quickFilter] : project?.name || space?.name || "Toutes les tâches";

  const hasActiveFilters =
    advancedFilters.statuses.length > 0 ||
    advancedFilters.priorities.length > 0 ||
    advancedFilters.assigneeIds.length > 0 ||
    advancedFilters.tags.length > 0;

  const navigateToAll = () => {
    setSelectedProjectId(null);
    setSelectedSpaceId(null);
    setQuickFilter("all");
  };

  const navigateToSpace = (spaceId: string) => {
    setSelectedProjectId(null);
    setSelectedSpaceId(spaceId);
    setQuickFilter("all");
  };

  // Build breadcrumb segments
  const breadcrumbs: { label: string; icon?: string; color?: string; onClick?: () => void }[] = [];

  if (!isQuickFilter) {
    if (project && parentSpace) {
      // Euthymia > Space > Project
      breadcrumbs.push({ label: "Euthymia", onClick: navigateToAll });
      breadcrumbs.push({
        label: parentSpace.name,
        icon: parentSpace.icon,
        onClick: () => navigateToSpace(parentSpace.id),
      });
      breadcrumbs.push({ label: project.name, color: project.color });
    } else if (space) {
      // Euthymia > Space
      breadcrumbs.push({ label: "Euthymia", onClick: navigateToAll });
      breadcrumbs.push({ label: space.name, icon: space.icon });
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="border-b border-border bg-card shrink-0">
          {/* Row 1: Title + actions */}
          <div className="h-12 sm:h-14 flex items-center px-3 sm:px-6 gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1 overflow-hidden">
              {sidebarCollapsed && !isMobile && (
                <button
                  onClick={() => setSidebarCollapsed(false)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                >
                  <PanelLeft className="w-5 h-5" />
                </button>
              )}
              {/* Breadcrumb navigation */}
              {breadcrumbs.length > 0 ? (
                <nav className="flex items-center gap-1 min-w-0 text-sm sm:text-lg overflow-hidden">
                  {isMobile ? (
                    // Mobile: only show last breadcrumb to prevent overflow
                    <h2 className="font-bold text-foreground text-sm truncate min-w-0">
                      {breadcrumbs[breadcrumbs.length - 1].color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                          style={{ backgroundColor: breadcrumbs[breadcrumbs.length - 1].color }}
                        />
                      )}
                      {breadcrumbs[breadcrumbs.length - 1].icon && (
                        <span className="mr-1">{breadcrumbs[breadcrumbs.length - 1].icon}</span>
                      )}
                      <span className="truncate">{breadcrumbs[breadcrumbs.length - 1].label}</span>
                    </h2>
                  ) : (
                    breadcrumbs.map((crumb, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="text-muted-foreground mx-0.5 shrink-0">›</span>}
                        {crumb.onClick ? (
                          <button
                            onClick={crumb.onClick}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate shrink min-w-0"
                          >
                            {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                            <span className="truncate">{crumb.label}</span>
                          </button>
                        ) : (
                          <h2 className="flex items-center gap-1.5 font-bold text-foreground truncate min-w-0">
                            {crumb.color && (
                              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: crumb.color }} />
                            )}
                            {crumb.icon && <span className="shrink-0">{crumb.icon}</span>}
                            <span className="truncate">{crumb.label}</span>
                          </h2>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </nav>
              ) : (
                <h2 className="font-bold text-foreground text-sm sm:text-lg truncate min-w-0">{title}</h2>
              )}

              {/* View selector — desktop inline */}
              {!isMobile && (
                <div className="flex items-center gap-0.5 ml-2 bg-muted/50 rounded-lg p-0.5 shrink-0">
                  {VIEW_OPTIONS.map((v) => (
                    <Tooltip key={v.key}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setSelectedView(v.key)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            selectedView === v.key
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
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
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <NotificationsDropdown />
              {/* Search button — desktop */}
              <button
                onClick={() => setSearchOpen(true)}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30 text-muted-foreground text-xs hover:bg-muted hover:text-foreground transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Rechercher…</span>
                <kbd className="ml-2 px-1.5 py-0.5 text-label font-medium bg-background rounded border border-border">
                  ⌘K
                </kbd>
              </button>
              {/* Search button — mobile */}
              {isMobile && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              {/* Mobile filter button */}
              {isMobile && (
                <Drawer open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <DrawerTrigger asChild>
                    <button
                      className={`relative inline-flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        hasActiveFilters
                          ? "border-primary/30 bg-primary/5 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {filterCount > 0 && (
                        <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-label">
                          {filterCount}
                        </span>
                      )}
                    </button>
                  </DrawerTrigger>
                  <DrawerContent className="pb-safe max-h-[85vh]">
                    <div className="px-4 pt-2 pb-6 overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <DrawerTitle className="text-base font-semibold text-foreground">Filtres</DrawerTitle>
                        <div className="flex items-center gap-3">
                          {hasActiveFilters && (
                            <button
                              onClick={() =>
                                setAdvancedFilters({ statuses: [], priorities: [], assigneeIds: [], tags: [] })
                              }
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              Tout effacer
                            </button>
                          )}
                          <button
                            onClick={() => setMobileFiltersOpen(false)}
                            className="p-1.5 -mr-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <TaskFilterBar />
                    </div>
                  </DrawerContent>
                </Drawer>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSuggestionsOpen(true)}
                    className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors shrink-0 active:scale-[0.97]"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Proposer des tâches</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Générer des suggestions de tâches basées sur votre projet</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Row 2: Mobile view selector */}
          {isMobile && (
            <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-none -mt-1">
              {VIEW_OPTIONS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setSelectedView(v.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                    selectedView === v.key
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v.icon}
                  {v.label}
                </button>
              ))}
            </div>
          )}

          {/* Filters - desktop only */}
          {!isMobile && (
            <div className="px-3 sm:px-6 pb-2">
              <TaskFilterBar />
            </div>
          )}
        </header>

        {/* Main content - add bottom padding on mobile for nav bar */}
        <main className={`flex-1 overflow-hidden ${isMobile ? "pb-16" : ""}`}>
          {selectedView === "dashboard" && (
            <div className="h-full overflow-y-auto">
              <DashboardView />
            </div>
          )}
          {selectedView === "kanban" && <KanbanBoard />}
          {selectedView === "list" && <ListView />}
          {selectedView === "calendar" && <CalendarView />}
          {selectedView === "workload" && <WorkloadView />}
          {selectedView === "mindmap" && <MindMapView />}
        </main>
      </div>

      {/* Task detail panel */}
      {selectedTaskId && <TaskDetailPanel />}

      {/* AI components */}
      <TaskSuggestions open={suggestionsOpen} onClose={() => setSuggestionsOpen(false)} />
      <AIChatPanel />
      <CommandPalette externalOpen={searchOpen} onExternalOpenChange={setSearchOpen} />

      {/* Keyboard shortcuts help */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />

      {/* Quick add task dialog */}
      {quickAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40"
          onClick={() => setQuickAddOpen(false)}
        >
          <div className="w-full max-w-md bg-card rounded-lg border shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={quickAddTitle}
              onChange={(e) => setQuickAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleQuickAdd();
                if (e.key === "Escape") {
                  setQuickAddOpen(false);
                  setQuickAddTitle("");
                }
              }}
              placeholder="Titre de la nouvelle tâche…"
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-muted-foreground">Entrée pour créer · Échap pour annuler</span>
              <button
                onClick={() => { setQuickAddOpen(false); setVoiceAddOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Dicter une tâche"
              >
                <Mic className="w-3.5 h-3.5" />
                Dicter
              </button>
            </div>
          </div>
        </div>
      )}

      {voiceAddOpen && (
        <VoiceTaskCreator
          onClose={() => setVoiceAddOpen(false)}
          defaultListId={(() => {
            const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
            return lists[0]?.id || "l1";
          })()}
        />
      )}

      {/* Shortcuts hint button — desktop only */}
      {!isMobile && (
        <button
          onClick={() => setShortcutsOpen(true)}
          className="fixed bottom-4 right-4 z-40 p-2 rounded-lg bg-card border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Raccourcis clavier (?)"
        >
          <Keyboard className="w-4 h-4" />
        </button>
      )}

      {/* Mobile bottom navigation */}
      {isMobile && !selectedTaskId && <MobileBottomNav onOpenVoice={() => setVoiceAddOpen(true)} />}
    </div>
  );
}
