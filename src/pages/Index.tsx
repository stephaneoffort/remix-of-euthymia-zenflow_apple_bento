import DashboardView from "@/components/DashboardView";
import DashboardViewNM from "@/components/DashboardViewNM";
import GanttView from "@/components/GanttView";
import TimelineView from "@/components/TimelineView";
import VoiceTaskCreator from "@/components/VoiceTaskCreator";
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppSidebar from "@/components/AppSidebar";
import SidebarNM from "@/components/SidebarNM";
import KanbanBoard from "@/components/KanbanBoard";
import KanbanBoardNM from "@/components/KanbanBoardNM";
import ListView from "@/components/ListView";
import CalendarView from "@/components/CalendarView";
import CalendarViewNM from "@/components/CalendarViewNM";
import WorkloadView from "@/components/WorkloadView";
import WorkloadViewNM from "@/components/WorkloadViewNM";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useThemeMode, PALETTE_META } from "@/context/ThemeContext";
import { useThemePreview } from "@/lib/themePreviewStore";

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
  GanttChart,
  AlignHorizontalJustifyStart,
  Search,
  X,
  Keyboard,
  Mic,
  GripVertical,
} from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const DEFAULT_VIEW_OPTIONS: { key: ViewType; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "kanban", label: "Kanban", icon: <LayoutGrid className="w-4 h-4" /> },
  { key: "list", label: "Liste", icon: <List className="w-4 h-4" /> },
  { key: "calendar", label: "Calendrier", icon: <Calendar className="w-4 h-4" /> },
  { key: "workload", label: "Charge", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "mindmap", label: "Carte mentale", icon: <Network className="w-4 h-4" /> },
  { key: "gantt", label: "Gantt", icon: <GanttChart className="w-4 h-4" /> },
  { key: "timeline", label: "Chronologie", icon: <AlignHorizontalJustifyStart className="w-4 h-4" /> },
];

const VIEW_MAP = Object.fromEntries(DEFAULT_VIEW_OPTIONS.map((v) => [v.key, v]));

const STORAGE_KEY = "euthymia:viewOrder";

function loadViewOrder(): ViewType[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ViewType[];
      // Ensure all views present (handles new views added later)
      const allKeys = DEFAULT_VIEW_OPTIONS.map((v) => v.key);
      const valid = parsed.filter((k) => allKeys.includes(k));
      const missing = allKeys.filter((k) => !valid.includes(k));
      return [...valid, ...missing];
    }
  } catch {}
  return DEFAULT_VIEW_OPTIONS.map((v) => v.key);
}

function saveViewOrder(order: ViewType[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
}

const QUICK_FILTER_TITLES: Record<string, string> = {
  all: "",
  my_tasks: "Mes tâches",
  urgent: "Tâches urgentes",
  today: "Tâches d'aujourd'hui",
  overdue: "Tâches en retard",
};

function ThemeIndicator() {
  const { palette, theme, designMode, typeVariant } = useThemeMode();
  const preview = useThemePreview();
  const effectivePalette = preview.palette ?? palette;
  const effectiveTheme = preview.theme ?? theme;
  const effectiveType = preview.type ?? typeVariant;
  const isPreviewing = preview.palette !== null || preview.theme !== null || preview.type !== null;
  const meta = PALETTE_META[effectivePalette];
  const label = meta?.label ?? effectivePalette;
  const colors = meta?.colors ?? ["#ccc"];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => { window.location.hash = "#theme"; window.dispatchEvent(new HashChangeEvent("hashchange")); }}
          className={`relative inline-flex items-center gap-1 px-1.5 py-1 rounded-md border transition-all shrink-0 ${
            isPreviewing
              ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-900/30 ring-1 ring-amber-500/40 animate-pulse'
              : 'border-border bg-muted/30 hover:bg-muted hover:text-foreground'
          }`}
          style={isPreviewing ? undefined : { borderColor: `${colors[0]}40` }}
        >
          <div className="flex -space-x-0.5">
            {colors.slice(0, 3).map((c, i) => (
              <span
                key={i}
                className="inline-block w-2.5 h-2.5 rounded-full border border-white/40 transition-colors"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <span className={`hidden md:inline text-[10px] font-medium tracking-tight ${isPreviewing ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}`}>
            {label.length > 12 ? label.slice(0, 12) + "…" : label}
          </span>
          {isPreviewing && (
            <span className="absolute -top-1.5 -right-1.5 px-1 py-0.5 rounded-full bg-amber-500 text-[8px] font-bold text-white uppercase tracking-wide leading-none">
              Aperçu
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            {label}
            {isPreviewing && <span className="text-amber-600 dark:text-amber-400 text-[9px] uppercase">· Aperçu</span>}
          </p>
          <p className="text-muted-foreground text-[10px]">
            {effectiveTheme === "light" ? "☀ Clair" : effectiveTheme === "dark" ? "☽ Sombre" : "⊙ Mixte"} · {designMode === "classic" ? "⊞ Classic" : "✦ Premium"} · {effectiveType}
          </p>
          {isPreviewing && (
            <p className="text-[9px] text-amber-700 dark:text-amber-400 italic">
              Cliquez sur l'option pour appliquer
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

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
  const [quickAddSpaceId, setQuickAddSpaceId] = useState<string>("");
  const [quickAddProjectId, setQuickAddProjectId] = useState<string>("");
  const [voiceAddOpen, setVoiceAddOpen] = useState(false);
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>([]);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [viewOrder, setViewOrder] = useState<ViewType[]>(loadViewOrder);
  const { designMode } = useThemeMode();
  console.log("designMode:", designMode);

  const orderedViews = useMemo(() => viewOrder.map((key) => VIEW_MAP[key]).filter(Boolean), [viewOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleViewDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setViewOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as ViewType);
      const newIndex = prev.indexOf(over.id as ViewType);
      const next = arrayMove(prev, oldIndex, newIndex);
      saveViewOrder(next);
      return next;
    });
  }, []);

  // Fetch today's upcoming calendar events count
  useEffect(() => {
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    supabase
      .from("calendar_events")
      .select("id", { count: "exact", head: true })
      .gte("start_time", now.toISOString())
      .lte("start_time", endOfDay.toISOString())
      .then(({ count }) => setTodayEventCount(count || 0));
  }, []);

  // Fetch project members when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectMemberIds([]);
      return;
    }
    supabase
      .from("project_members")
      .select("member_id")
      .eq("project_id", selectedProjectId)
      .then(({ data }) => setProjectMemberIds((data || []).map((r) => r.member_id)));
  }, [selectedProjectId]);

  const projectResponsibles = useMemo(
    () => teamMembers.filter((m) => projectMemberIds.includes(m.id)),
    [teamMembers, projectMemberIds],
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: useCallback(() => setQuickAddOpen(true), []),
    onClosePanel: useCallback(() => {
      if (selectedTaskId) setSelectedTaskId(null);
    }, [selectedTaskId, setSelectedTaskId]),
    onOpenSearch: useCallback(() => setSearchOpen(true), []),
    onToggleHelp: useCallback(() => setShortcutsOpen((prev) => !prev), []),
  });

  // Pré-remplit espace/projet à l'ouverture du quick-add
  useEffect(() => {
    if (!quickAddOpen) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    const initialSpace = project?.spaceId || selectedSpaceId || spaces[0]?.id || "";
    setQuickAddSpaceId(initialSpace);
    const projectsInSpace = projects.filter((p) => p.spaceId === initialSpace && !p.isArchived);
    setQuickAddProjectId(selectedProjectId || projectsInSpace[0]?.id || "");
  }, [quickAddOpen, selectedProjectId, selectedSpaceId, projects, spaces]);

  // Quand on change l'espace dans le quick-add, on réinitialise le projet
  useEffect(() => {
    if (!quickAddOpen || !quickAddSpaceId) return;
    const projectsInSpace = projects.filter((p) => p.spaceId === quickAddSpaceId && !p.isArchived);
    if (!projectsInSpace.find((p) => p.id === quickAddProjectId)) {
      setQuickAddProjectId(projectsInSpace[0]?.id || "");
    }
  }, [quickAddSpaceId, quickAddOpen, projects, quickAddProjectId]);

  const handleQuickAdd = () => {
    if (!quickAddTitle.trim() || !quickAddProjectId) return;
    const lists = getListsForProject(quickAddProjectId);
    const listId = lists[0]?.id;
    if (!listId) return;
    addTask({
      title: quickAddTitle.trim(),
      description: "",
      status: "todo",
      priority: "normal",
      dueDate: null,
      startDate: null,
      assigneeIds: quickFilter === "my_tasks" && teamMemberId ? [teamMemberId] : [],
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
    <div className={`flex h-screen overflow-hidden design-mode-transition ${designMode === "neumorphic" ? "" : "bg-background"}`}>
      {designMode === "neumorphic" ? <SidebarNM /> : <AppSidebar />}
      <div className="flex-1 flex flex-col min-w-0" style={designMode === "neumorphic" ? { background: "#EDE6DA" } : {}}>
        {/* Top bar */}
        <header className={`shrink-0 ${designMode === "neumorphic" ? "border-b" : "border-b border-border bg-card"}`} style={designMode === "neumorphic" ? { background: "#C8BDAD", borderColor: "rgba(140,118,88,0.25)", boxShadow: "0 4px 12px rgba(140,118,88,0.3)" } : {}}>
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
                <nav className="flex items-center gap-1 min-w-0 text-sm sm:text-lg overflow-hidden py-0.5">
                  {isMobile ? (
                    // Mobile: only show last breadcrumb to prevent overflow
                    <h2 className="font-display font-bold text-foreground text-sm truncate min-w-0 leading-relaxed py-0.5">
                      {breadcrumbs[breadcrumbs.length - 1].color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                          style={{ backgroundColor: breadcrumbs[breadcrumbs.length - 1].color }}
                        />
                      )}
                      {breadcrumbs[breadcrumbs.length - 1].icon && (
                        <span className="mr-1 inline-flex align-middle"><SpaceIcon value={breadcrumbs[breadcrumbs.length - 1].icon} size="xs" /></span>
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
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors truncate shrink min-w-0 leading-relaxed py-0.5"
                          >
                            {crumb.icon && <SpaceIcon value={crumb.icon} size="xs" className="shrink-0" />}
                            <span className="truncate">{crumb.label}</span>
                          </button>
                        ) : (
                          <h2 className="font-display flex items-center gap-1.5 font-bold text-foreground truncate min-w-0 leading-relaxed py-0.5">
                            {crumb.color && (
                              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: crumb.color }} />
                            )}
                            {crumb.icon && <SpaceIcon value={crumb.icon} size="xs" className="shrink-0" />}
                            <span className="truncate">{crumb.label}</span>
                          </h2>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </nav>
              ) : (
                <h2 className="font-display font-bold text-foreground text-sm sm:text-lg truncate min-w-0 leading-relaxed py-0.5">{title}</h2>
              )}

              {/* Project responsibles */}
              {selectedProjectId && projectResponsibles.length > 0 && (
                <div className="flex items-center gap-0.5 ml-2 shrink-0">
                  <div className="flex -space-x-1.5">
                    {projectResponsibles.slice(0, 5).map((m) => (
                      <Tooltip key={m.id}>
                        <TooltipTrigger asChild>
                          {m.avatarUrl ? (
                            <img
                              src={m.avatarUrl}
                              alt={m.name}
                              className="w-6 h-6 rounded-full border-2 border-card object-cover"
                            />
                          ) : (
                            <div
                              className="w-6 h-6 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-bold text-white"
                              style={{ backgroundColor: m.avatarColor }}
                            >
                              {m.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)}
                            </div>
                          )}
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {m.name}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {projectResponsibles.length > 5 && (
                      <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                        +{projectResponsibles.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* View selector — desktop inline with drag & drop */}
              {!isMobile && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
                  <SortableContext items={viewOrder} strategy={horizontalListSortingStrategy}>
                    <div className="flex items-center gap-0.5 ml-2 bg-muted/50 rounded-lg p-0.5 shrink-0">
                      {orderedViews.map((v) => (
                        <SortableViewTab
                          key={v.key}
                          viewKey={v.key}
                          label={v.label}
                          icon={v.icon}
                          isActive={selectedView === v.key}
                          onClick={() => setSelectedView(v.key)}
                          todayEventCount={v.key === "calendar" ? todayEventCount : 0}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <ThemeIndicator />
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
                        <span data-numeric className="font-numeric tabular-nums bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-label">
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

          {/* Row 2: Mobile view selector with drag & drop */}
          {isMobile && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
              <SortableContext items={viewOrder} strategy={horizontalListSortingStrategy}>
                <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-none -mt-1">
                  {orderedViews.map((v) => (
                    <SortableViewTabMobile
                      key={v.key}
                      viewKey={v.key}
                      label={v.label}
                      icon={v.icon}
                      isActive={selectedView === v.key}
                      onClick={() => setSelectedView(v.key)}
                      todayEventCount={v.key === "calendar" ? todayEventCount : 0}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Filters - desktop only */}
          {!isMobile && (
            <div className="px-3 sm:px-6 pb-2">
              <TaskFilterBar />
            </div>
          )}
        </header>

        {/* Main content - add bottom padding on mobile for nav bar */}
        <main className={`flex-1 overflow-hidden ${isMobile ? "pb-16" : ""}`} style={designMode === "neumorphic" ? { background: "#EDE6DA" } : {}}>
          {selectedView === "dashboard" && (
            <div className="h-full overflow-y-auto w-full">
              {designMode === "neumorphic" ? <DashboardViewNM /> : <DashboardView />}
            </div>
          )}
          {selectedView === "kanban" && (designMode === "neumorphic" ? <KanbanBoardNM /> : <KanbanBoard />)}
          {selectedView === "list" && <ListView />}
          {selectedView === "calendar" && (designMode === "neumorphic" ? <CalendarViewNM /> : <CalendarView />)}
          {selectedView === "workload" && (designMode === "neumorphic" ? <WorkloadViewNM /> : <WorkloadView />)}
          {selectedView === "mindmap" && <MindMapView />}
          {selectedView === "gantt" && <GanttView />}
          {selectedView === "timeline" && <TimelineView />}
        </main>
      </div>

      {/* Task detail panel with slide animation */}
      <TaskPanelAnimated taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />

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
          <div className="w-full max-w-md bg-card rounded-lg border shadow-lg p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Espace</label>
                <Select value={quickAddSpaceId} onValueChange={setQuickAddSpaceId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choisir un espace…" />
                  </SelectTrigger>
                  <SelectContent>
                    {spaces.filter(s => !s.isArchived).map(s => (
                      <SelectItem key={s.id} value={s.id}><span className="inline-flex items-center gap-2"><SpaceIcon value={s.icon} size="xs" /> {s.name}</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Projet</label>
                <Select value={quickAddProjectId} onValueChange={setQuickAddProjectId} disabled={!quickAddSpaceId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choisir un projet…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter(p => p.spaceId === quickAddSpaceId && !p.isArchived).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">Entrée pour créer · Échap pour annuler</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setQuickAddOpen(false);
                    setVoiceAddOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="Dicter une tâche"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Dicter
                </button>
                <button
                  onClick={handleQuickAdd}
                  disabled={!quickAddTitle.trim() || !quickAddProjectId}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
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

function TaskPanelAnimated({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const lastTaskId = useRef(taskId);

  useEffect(() => {
    if (taskId) {
      lastTaskId.current = taskId;
      setVisible(true);
      setClosing(false);
    } else if (visible) {
      setClosing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 280);
      return () => clearTimeout(timer);
    }
  }, [taskId]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setVisible(false);
      setClosing(false);
    }, 280);
  }, [onClose]);

  if (!visible) return null;

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${closing ? "opacity-0" : "opacity-100"}`}
        onClick={handleClose}
      />
      <div
        className={`fixed z-50 inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[520px] ${closing ? "animate-slide-out-right" : "animate-slide-in-right"}`}
      >
        <TaskDetailPanel />
      </div>
    </>
  );
}

// ── Sortable View Tab (Desktop) ──
interface SortableViewTabProps {
  viewKey: ViewType;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  todayEventCount: number;
}

function SortableViewTab({ viewKey, label, icon, isActive, onClick, todayEventCount }: SortableViewTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: viewKey });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onClick}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-grab active:cursor-grabbing ${
            isActive ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="relative">
            {icon}
            {todayEventCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
                {todayEventCount > 99 ? "99+" : todayEventCount}
              </span>
            )}
          </span>
          <span className="hidden lg:inline">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="lg:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Sortable View Tab (Mobile) ──
function SortableViewTabMobile({ viewKey, label, icon, isActive, onClick, todayEventCount }: SortableViewTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: viewKey });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors shrink-0 cursor-grab active:cursor-grabbing ${
        isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="relative">
        {icon}
        {todayEventCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none">
            {todayEventCount > 99 ? "99+" : todayEventCount}
          </span>
        )}
      </span>
      {label}
    </button>
  );
}
