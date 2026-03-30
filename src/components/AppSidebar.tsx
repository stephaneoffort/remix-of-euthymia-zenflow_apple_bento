import React, { useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import logoEuthymia from '@/assets/logo-euthymia.png';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronRight, ChevronDown, ChevronUp, LayoutGrid, AlertCircle, Clock, User, Flame, PanelLeftClose, PanelLeft, LogOut, Plus, Settings, Trash2, GripVertical, MessageCircle, MessageSquare, Shield, Crown, Lock, Sun, Moon, SunMoon, MoreHorizontal, Pencil, Home, FolderInput, ArrowDownToLine, MoveHorizontal, Copy, Archive, Users } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent,
} from '@/components/ui/context-menu';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { QuickFilter } from '@/types';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { useMessages } from '@/hooks/useMessages';
import { usePresence } from '@/hooks/usePresence';
import SpaceAccessDialog from '@/components/SpaceAccessDialog';
import ProjectMembersDialog from '@/components/ProjectMembersDialog';
import { useThemeMode } from '@/context/ThemeContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const QUICK_FILTERS: { key: QuickFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Toutes les tâches', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'my_tasks', label: 'Mes tâches', icon: <User className="w-4 h-4" /> },
  { key: 'urgent', label: 'Urgentes', icon: <Flame className="w-4 h-4" /> },
  { key: 'today', label: "Aujourd'hui", icon: <Clock className="w-4 h-4" /> },
  { key: 'overdue', label: 'En retard', icon: <AlertCircle className="w-4 h-4" /> },
];


const SPACE_ICONS = ['📁', '🚀', '💡', '🎯', '📊', '🛠️', '📚', '🌟', '🧘', '🎨'];
const PROJECT_COLORS = ['#C9A84C', '#E2D08A', '#F5EFE0', '#D4915C', '#4A6FA5', '#3D8B7A', '#C47B7B', '#7B68AE'];

export default function AppSidebar() {
  const {
    spaces, selectedProjectId, setSelectedProjectId, selectedSpaceId, setSelectedSpaceId,
    quickFilter, setQuickFilter, selectedView, setSelectedView,
    getProjectsForSpace, getTasksForProject, teamMembers, sidebarCollapsed, setSidebarCollapsed, lists,
    tasks, addSpace, addProject, duplicateSpace, duplicateProject, archiveSpace, archiveProject, renameSpace, renameProject, moveProject, deleteSpace, deleteProject,
    reorderSpaces, reorderProjects, canAccessSpace, isSpaceManager, getSpaceManagers, refreshSpaceAccess,
    updateTask, getListsForProject,
  } = useApp();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isOnline } = usePresence();
  const { user } = useAuth();

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('euthymia:sidebarWidth');
      if (saved) return Math.max(200, Math.min(400, Number(saved)));
    } catch {}
    return 256;
  });
  const isResizing = React.useRef(false);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(400, startWidth + ev.clientX - startX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('euthymia:sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('euthymia:expandedSpaces');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    return new Set(spaces.map(s => s.id));
  });
  // Track which space IDs we've already seen, to only auto-expand truly new ones
  const [knownSpaceIds, setKnownSpaceIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('euthymia:knownSpaceIds');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch {}
    return new Set<string>();
  });
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState('📁');
  const [newSpacePrivate, setNewSpacePrivate] = useState(false);
  const [addingProjectForSpace, setAddingProjectForSpace] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [newProjectMemberIds, setNewProjectMemberIds] = useState<string[]>([]);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'space' | 'project'; id: string; name: string } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(() => !window.matchMedia('(max-width: 767px)').matches);
  const [accessDialogSpace, setAccessDialogSpace] = useState<{ id: string; name: string; isPrivate: boolean } | null>(null);
  const [membersDialogProject, setMembersDialogProject] = useState<{ id: string; name: string } | null>(null);

  // Drag & drop state for cross-space project moves and task-to-project drops
  const [dragOverSpaceId, setDragOverSpaceId] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);

  // Filter spaces based on access
  const visibleSpaces = spaces.filter(s => canAccessSpace(s.id));

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  // Only auto-expand truly new spaces (never seen before), preserve user's collapsed state
  useEffect(() => {
    if (spaces.length === 0) return;
    const currentIds = new Set(spaces.map(s => s.id));
    const hadKnown = knownSpaceIds.size > 0;
    const newIds = hadKnown
      ? [...currentIds].filter(id => !knownSpaceIds.has(id))
      : [];
    if (newIds.length > 0) {
      setExpandedSpaces(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
    }
    // If no prior known IDs and no saved expanded state, initialize all expanded
    if (!hadKnown && !localStorage.getItem('euthymia:expandedSpaces')) {
      setExpandedSpaces(new Set(currentIds));
    }
    setKnownSpaceIds(currentIds);
  }, [spaces]);

  // Persist expanded state and known IDs to localStorage
  useEffect(() => {
    localStorage.setItem('euthymia:expandedSpaces', JSON.stringify([...expandedSpaces]));
  }, [expandedSpaces]);
  useEffect(() => {
    localStorage.setItem('euthymia:knownSpaceIds', JSON.stringify([...knownSpaceIds]));
  }, [knownSpaceIds]);

  const toggleSpace = (id: string) => {
    setExpandedSpaces(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleSpaceDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = spaces.findIndex(s => s.id === active.id);
    const newIndex = spaces.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(spaces, oldIndex, newIndex);
    reorderSpaces(newOrder.map(s => s.id));
  }, [spaces, reorderSpaces]);

  const handleProjectDragEnd = useCallback((event: DragEndEvent, spaceId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const spaceProjects = getProjectsForSpace(spaceId);
    const oldIndex = spaceProjects.findIndex(p => p.id === active.id);
    const newIndex = spaceProjects.findIndex(p => p.id === over.id);
    const newOrder = arrayMove(spaceProjects, oldIndex, newIndex);
    reorderProjects(spaceId, newOrder.map(p => p.id));
  }, [getProjectsForSpace, reorderProjects]);

  const overdueCount = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate && t.dueDate < today && t.status !== 'done';
  }).length;

  const handleNavClick = () => {
    if (isMobile) setSidebarCollapsed(true);
  };

  const handleAddSpace = () => {
    if (!newSpaceName.trim()) return;
    addSpace(newSpaceName.trim(), newSpaceIcon, newSpacePrivate);
    setNewSpaceName('');
    setNewSpaceIcon('📁');
    setNewSpacePrivate(false);
    setAddingSpace(false);
  };

  const handleAddProject = (spaceId: string) => {
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim(), spaceId, newProjectColor, newProjectMemberIds.length > 0 ? newProjectMemberIds : undefined);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setNewProjectMemberIds([]);
    setAddingProjectForSpace(null);
  };

  // Native drag & drop: project dragged to a different space
  const handleProjectNativeDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('type', 'project');
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingProjectId(projectId);
  };

  const handleSpaceDragOver = (e: React.DragEvent, spaceId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSpaceId(spaceId);
  };

  const handleSpaceDragLeave = () => {
    setDragOverSpaceId(null);
  };

  const handleSpaceDrop = (e: React.DragEvent, spaceId: string) => {
    e.preventDefault();
    setDragOverSpaceId(null);
    setDraggingProjectId(null);
    const type = e.dataTransfer.getData('type');
    if (type === 'project') {
      const projectId = e.dataTransfer.getData('projectId');
      const project = spaces.flatMap(s => getProjectsForSpace(s.id)).find(p => p.id === projectId);
      if (project && project.spaceId !== spaceId) {
        const targetSpace = spaces.find(s => s.id === spaceId);
        const prevSpaceId = project.spaceId;
        moveProject(projectId, spaceId);
        toast({
          title: 'Projet déplacé',
          description: `« ${project.name} » → ${targetSpace?.icon || ''} ${targetSpace?.name || 'espace'}`,
          action: <ToastAction altText="Annuler" onClick={() => moveProject(projectId, prevSpaceId)}>Annuler</ToastAction>,
        });
      }
    }
  };

  // Native drag & drop: task dragged to a project in sidebar
  const handleProjectNativeDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverProjectId(projectId);
  };

  const handleProjectNativeDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setDragOverProjectId(null);
  };

  const handleProjectNativeDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverProjectId(null);
    setDraggingProjectId(null);
    const type = e.dataTransfer.getData('type');
    if (type === 'task') {
      const taskId = e.dataTransfer.getData('taskId');
      if (taskId) {
        const targetLists = getListsForProject(projectId);
        if (targetLists.length > 0) {
          const task = tasks.find(t => t.id === taskId);
          const targetProject = spaces.flatMap(s => getProjectsForSpace(s.id)).find(p => p.id === projectId);
          const prevListId = task?.listId;
          updateTask(taskId, { listId: targetLists[0].id });
          setSelectedProjectId(projectId);
          toast({
            title: 'Tâche déplacée',
            description: `« ${task?.title || 'Tâche'} » → ${targetProject?.name || 'projet'}`,
            action: prevListId ? <ToastAction altText="Annuler" onClick={() => updateTask(taskId, { listId: prevListId })}>Annuler</ToastAction> : undefined,
          });
        }
      }
    } else if (type === 'project') {
      // Project dropped on another project → move to same space
      const draggedProjId = e.dataTransfer.getData('projectId');
      const targetProject = spaces.flatMap(s => getProjectsForSpace(s.id)).find(p => p.id === projectId);
      if (draggedProjId && targetProject) {
        const sourceProject = spaces.flatMap(s => getProjectsForSpace(s.id)).find(p => p.id === draggedProjId);
        if (sourceProject && sourceProject.spaceId !== targetProject.spaceId) {
          moveProject(draggedProjId, targetProject.spaceId);
        }
      }
    }
  };

  const handleNativeDragEnd = () => {
    setDraggingProjectId(null);
    setDragOverSpaceId(null);
    setDragOverProjectId(null);
  };
  // Swipe-to-close for mobile sidebar
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart !== null && isMobile) {
      const delta = e.changedTouches[0].clientX - touchStart;
      if (delta < -60) setSidebarCollapsed(true);
    }
    setTouchStart(null);
  };

  if (sidebarCollapsed) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="w-[52px] bg-sidebar-bg flex flex-col items-center py-3 border-r border-sidebar-border-color shrink-0 gap-0.5">
          {/* Expand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setSidebarCollapsed(false)} className="p-2 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors">
                <PanelLeft className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Ouvrir la sidebar</TooltipContent>
          </Tooltip>

          <div className="w-6 border-t border-sidebar-border-color my-1.5" />

          {/* Dashboard */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => { setSelectedView('dashboard'); setSelectedProjectId(null); setSelectedSpaceId(null); setQuickFilter('all'); }}
                className={`p-2 rounded-md transition-colors ${
                  selectedView === 'dashboard' ? 'bg-sidebar-active text-sidebar-active-fg' : 'text-sidebar-fg hover:bg-sidebar-hover'
                }`}
              >
                <Home className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Dashboard</TooltipContent>
          </Tooltip>

          {/* Quick Filters */}
          {QUICK_FILTERS.map(f => (
            <Tooltip key={f.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setQuickFilter(f.key);
                    if (f.key === 'all') { setSelectedProjectId(null); setSelectedSpaceId(null); }
                    else { setSelectedProjectId(null); }
                  }}
                  className={`relative p-2 rounded-md transition-colors ${
                    quickFilter === f.key && !selectedProjectId
                      ? 'bg-sidebar-active text-sidebar-active-fg'
                      : 'text-sidebar-fg hover:bg-sidebar-hover'
                  }`}
                >
                  {f.icon}
                  {f.key === 'overdue' && overdueCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-priority-urgent text-sidebar-fg-bright rounded-full text-label flex items-center justify-center font-bold">
                      {overdueCount > 9 ? '9+' : overdueCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{f.label}</TooltipContent>
            </Tooltip>
          ))}

          {/* Messages */}
          <MessagesCollapsedIcon />

          <div className="w-6 border-t border-sidebar-border-color my-1.5" />

          {/* Spaces & Projects */}
          <div className="flex flex-col items-center gap-0.5 overflow-y-auto scrollbar-none flex-1 w-full px-1">
            {visibleSpaces.map(space => {
              const spaceProjects = getProjectsForSpace(space.id);
              const isSpaceSelected = selectedSpaceId === space.id && !selectedProjectId;
              return (
                <React.Fragment key={space.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          setSelectedSpaceId(space.id);
                          setSelectedProjectId(null);
                          setQuickFilter('all');
                        }}
                        className={`w-9 h-9 rounded-md flex items-center justify-center text-sm transition-colors shrink-0 ${
                          isSpaceSelected
                            ? 'bg-sidebar-active text-sidebar-active-fg'
                            : 'text-sidebar-fg hover:bg-sidebar-hover'
                        }`}
                      >
                        {space.icon}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{space.name}</TooltipContent>
                  </Tooltip>
                  {spaceProjects.map(proj => {
                    const isActive = selectedProjectId === proj.id;
                    return (
                      <Tooltip key={proj.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => {
                              setSelectedProjectId(proj.id);
                              setQuickFilter('all');
                            }}
                            className={`w-9 h-7 rounded-md flex items-center justify-center transition-colors shrink-0 ${
                              isActive
                                ? 'bg-sidebar-active'
                                : 'hover:bg-sidebar-hover'
                            }`}
                          >
                            <div
                              className={`w-3 h-3 rounded-sm transition-transform ${isActive ? 'scale-125' : ''}`}
                              style={{ backgroundColor: proj.color }}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: proj.color }} />
                            {proj.name}
                          </span>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          <div className="w-6 border-t border-sidebar-border-color my-1.5" />

          {/* Chat */}
          <CollapsedChatIcon />

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors"
              >
                <Settings className="w-4.5 h-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Paramètres</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <div
        className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : 'relative'} bg-sidebar-bg flex flex-col border-r border-sidebar-border-color shrink-0 h-screen`}
        style={{ width: isMobile ? 256 : sidebarWidth }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
      {/* Resize handle */}
      {!isMobile && (
        <div
          onMouseDown={handleResizeStart}
          onDoubleClick={() => { setSidebarWidth(256); localStorage.setItem('euthymia:sidebarWidth', '256'); }}
          className="absolute top-0 -right-[3px] w-[6px] h-full cursor-col-resize z-30 group/resize"
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] opacity-0 hover:opacity-100 group-hover/resize:opacity-100 bg-primary/40 transition-opacity" />
        </div>
      )}
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-sidebar-border-color">
        <div className="flex items-center gap-2.5">
          <img src={logoEuthymia} alt="Euthymia" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h1 className="text-sidebar-fg-bright font-bold text-lg leading-tight">Euthymia</h1>
            <p className="text-sidebar-fg text-xs">Gestion de projets</p>
          </div>
        </div>
        <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors btn-icon-touch flex items-center justify-center">
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>


      {/* Dashboard button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => { setSelectedView('dashboard'); setSelectedProjectId(null); setSelectedSpaceId(null); setQuickFilter('all'); handleNavClick(); }}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium transition-colors ${
            selectedView === 'dashboard' ? 'bg-sidebar-active text-sidebar-active-fg' : 'text-sidebar-fg hover:bg-sidebar-hover'
          }`}
        >
          <Home className="w-4 h-4" />
          Dashboard
        </button>
      </div>

      {/* Quick Filters - collapsible on mobile */}
      <div className="px-3 py-3 border-b border-sidebar-border-color">
        <button
          onClick={() => setFiltersExpanded(prev => !prev)}
          className="w-full flex items-center justify-between px-2 mb-2"
        >
          <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider">Filtres</p>
          {isMobile && (
            <ChevronRight className={`w-3.5 h-3.5 text-sidebar-fg transition-transform ${filtersExpanded ? 'rotate-90' : ''}`} />
          )}
        </button>
        {filtersExpanded && (
          <>
            {QUICK_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => {
                  setQuickFilter(f.key);
                  if (f.key === 'all') { setSelectedProjectId(null); setSelectedSpaceId(null); }
                  else { setSelectedProjectId(null); }
                  handleNavClick();
                }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                  quickFilter === f.key && !selectedProjectId
                    ? 'bg-sidebar-active text-sidebar-active-fg'
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
            <MessagesLink handleNavClick={handleNavClick} />
            <ChatLink handleNavClick={handleNavClick} />
          </>
        )}
      </div>

      {/* Spaces & Projects */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-1">
          <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider">Espaces</p>
          <button
            onClick={() => setAddingSpace(true)}
            className="p-2 -m-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors"
            title="Ajouter un espace"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {draggingProjectId ? (
          <p className="text-[10px] text-primary/70 px-2 mb-2 leading-tight font-medium flex items-center gap-1">
            <MoveHorizontal className="w-3 h-3" />
            Déposez sur un espace pour déplacer le projet
          </p>
        ) : null}

        {/* Add space form */}
        {addingSpace && (
          <div className="mb-2 mx-2 bg-sidebar-hover rounded-md p-2 space-y-2">
            <div className="flex gap-1 flex-wrap">
              {SPACE_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setNewSpaceIcon(icon)}
                  className={`w-9 h-9 rounded text-sm flex items-center justify-center transition-colors ${
                    newSpaceIcon === icon ? 'bg-sidebar-active ring-1 ring-primary' : 'hover:bg-sidebar-bg'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
            <input
              autoFocus
              value={newSpaceName}
              onChange={e => setNewSpaceName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddSpace();
                if (e.key === 'Escape') { setAddingSpace(false); setNewSpaceName(''); setNewSpacePrivate(false); }
              }}
              placeholder="Nom de l'espace..."
              className="w-full text-sm bg-sidebar-bg border border-sidebar-border-color rounded-md px-2 py-1 outline-none text-sidebar-fg-bright placeholder:text-sidebar-fg"
            />
            <div className="flex items-center justify-between">
              <label className="text-xs text-sidebar-fg flex items-center gap-1.5 cursor-pointer">
                <Lock className="w-3 h-3" />
                Espace privé
              </label>
              <button
                onClick={() => setNewSpacePrivate(!newSpacePrivate)}
                className={`w-8 h-4 rounded-full transition-colors relative ${newSpacePrivate ? 'bg-primary' : 'bg-sidebar-border-color'}`}
              >
                <span className={`block w-3 h-3 rounded-full bg-background shadow absolute top-0.5 transition-transform ${newSpacePrivate ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleAddSpace}
                disabled={!newSpaceName.trim()}
                className="flex-1 text-xs bg-primary text-primary-foreground rounded-md py-1 font-medium hover:opacity-90 disabled:opacity-50"
              >
                Créer
              </button>
              <button
                onClick={() => { setAddingSpace(false); setNewSpaceName(''); setNewSpacePrivate(false); }}
                className="flex-1 text-xs text-sidebar-fg rounded-md py-1 hover:bg-sidebar-bg"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSpaceDragEnd}
        >
          <SortableContext items={visibleSpaces.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {visibleSpaces.map(space => (
              <SortableSpace key={space.id} space={space}>
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`flex items-center group transition-all ${
                        dragOverSpaceId === space.id
                          ? 'bg-primary/20 rounded-md ring-2 ring-primary/50 shadow-sm shadow-primary/10'
                          : draggingProjectId
                            ? 'rounded-md border border-dashed border-sidebar-fg/20'
                            : ''
                      }`}
                      onDragOver={e => handleSpaceDragOver(e, space.id)}
                      onDragLeave={handleSpaceDragLeave}
                      onDrop={e => handleSpaceDrop(e, space.id)}
                    >
                      <button
                        onClick={() => toggleSpace(space.id)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
                      >
                        {expandedSpaces.has(space.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span>{space.icon}</span>
                      </button>
                      {editingSpaceId === space.id ? (
                        <input
                          autoFocus
                          value={editingSpaceName}
                          onChange={e => setEditingSpaceName(e.target.value)}
                          onBlur={() => {
                            if (editingSpaceName.trim() && editingSpaceName.trim() !== space.name) {
                              renameSpace(space.id, editingSpaceName.trim());
                            }
                            setEditingSpaceId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              if (editingSpaceName.trim() && editingSpaceName.trim() !== space.name) {
                                renameSpace(space.id, editingSpaceName.trim());
                              }
                              setEditingSpaceId(null);
                            }
                            if (e.key === 'Escape') setEditingSpaceId(null);
                          }}
                          className="flex-1 text-sm bg-sidebar-bg border border-sidebar-border-color rounded-md px-2 py-0.5 outline-none text-sidebar-fg-bright font-medium min-w-0"
                        />
                      ) : dragOverSpaceId === space.id ? (
                        <span className="flex-1 font-medium text-sm text-primary flex items-center gap-1.5 animate-pulse">
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                          Déposer ici
                        </span>
                      ) : (
                        <span
                          className={`flex-1 font-semibold text-sm cursor-pointer truncate flex items-center gap-1 ${
                            selectedSpaceId === space.id ? 'text-sidebar-fg-bright' : 'text-sidebar-fg'
                          }`}
                          onClick={() => {
                            setSelectedSpaceId(space.id);
                            setQuickFilter('all');
                            handleNavClick();
                            if (!expandedSpaces.has(space.id)) toggleSpace(space.id);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingSpaceId(space.id);
                            setEditingSpaceName(space.name);
                          }}
                        >
                          {space.name}
                          {space.isPrivate && <Lock className="w-3 h-3 text-sidebar-fg shrink-0" />}
                        </span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className={`p-2 -m-1 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-opacity mr-0.5 ${isMobile ? 'opacity-80' : 'opacity-40 group-hover:opacity-100'}`}
                            onClick={e => e.stopPropagation()}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setAccessDialogSpace({ id: space.id, name: space.name, isPrivate: space.isPrivate })}>
                            <Shield className="w-4 h-4 mr-2" />
                            Gérer les accès
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setAddingProjectForSpace(space.id)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Ajouter un projet
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setEditingSpaceId(space.id);
                            setEditingSpaceName(space.name);
                          }}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateSpace(space.id)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archiveSpace(space.id)}>
                            <Archive className="w-4 h-4 mr-2" />
                            {space.isArchived ? 'Désarchiver' : 'Archiver'}
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm({ type: 'space', id: space.id, name: space.name })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onClick={() => setAccessDialogSpace({ id: space.id, name: space.name, isPrivate: space.isPrivate })}>
                      <Shield className="w-4 h-4 mr-2" />
                      Gérer les accès
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => setAddingProjectForSpace(space.id)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter un projet
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => {
                      setEditingSpaceId(space.id);
                      setEditingSpaceName(space.name);
                    }}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Renommer
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => duplicateSpace(space.id)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Dupliquer
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => archiveSpace(space.id)}>
                      <Archive className="w-4 h-4 mr-2" />
                      {space.isArchived ? 'Désarchiver' : 'Archiver'}
                    </ContextMenuItem>
                    {isAdmin && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => setDeleteConfirm({ type: 'space', id: space.id, name: space.name })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
                {expandedSpaces.has(space.id) && (
                  <div className="ml-4">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(event) => handleProjectDragEnd(event, space.id)}
                    >
                      <SortableContext items={getProjectsForSpace(space.id).map(p => p.id)} strategy={verticalListSortingStrategy}>
                        {getProjectsForSpace(space.id).map(project => (
                          editingProjectId === project.id ? (
                            <div key={project.id} className="flex items-center gap-2 px-2 py-1.5">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                              <input
                                autoFocus
                                value={editingProjectName}
                                onChange={e => setEditingProjectName(e.target.value)}
                                onBlur={() => {
                                  if (editingProjectName.trim() && editingProjectName.trim() !== project.name) {
                                    renameProject(project.id, editingProjectName.trim());
                                  }
                                  setEditingProjectId(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    if (editingProjectName.trim() && editingProjectName.trim() !== project.name) {
                                      renameProject(project.id, editingProjectName.trim());
                                    }
                                    setEditingProjectId(null);
                                  }
                                  if (e.key === 'Escape') setEditingProjectId(null);
                                }}
                                className="flex-1 text-sm bg-sidebar-bg border border-sidebar-border-color rounded-md px-2 py-0.5 outline-none text-sidebar-fg-bright min-w-0"
                              />
                            </div>
                          ) : (
                            <SortableProject key={project.id} id={project.id}>
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <button
                                    draggable
                                    onDragStart={e => handleProjectNativeDragStart(e, project.id)}
                                    onDragEnd={handleNativeDragEnd}
                                    onDragOver={e => handleProjectNativeDragOver(e, project.id)}
                                    onDragLeave={handleProjectNativeDragLeave}
                                    onDrop={e => handleProjectNativeDrop(e, project.id)}
                                    onClick={() => {
                                      setSelectedProjectId(project.id);
                                      setQuickFilter('all');
                                      handleNavClick();
                                    }}
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      setEditingProjectId(project.id);
                                      setEditingProjectName(project.name);
                                    }}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all cursor-grab active:cursor-grabbing ${
                                      dragOverProjectId === project.id
                                        ? 'bg-primary/20 ring-2 ring-primary/50 shadow-sm shadow-primary/10'
                                        : selectedProjectId === project.id
                                          ? 'bg-sidebar-active text-sidebar-active-fg'
                                          : 'text-sidebar-fg/75 hover:text-sidebar-fg hover:bg-sidebar-hover'
                                    } ${draggingProjectId === project.id ? 'opacity-50 scale-95' : ''}`}
                                  >
                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                                    <span className="flex-1 min-w-0 truncate">{project.name}</span>
                                  </button>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-44">
                                  <ContextMenuItem onClick={() => setMembersDialogProject({ id: project.id, name: project.name })}>
                                    <Users className="w-4 h-4 mr-2" />
                                    Responsables
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => {
                                    setEditingProjectId(project.id);
                                    setEditingProjectName(project.name);
                                  }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Renommer
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => duplicateProject(project.id)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Dupliquer
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => archiveProject(project.id)}>
                                    <Archive className="w-4 h-4 mr-2" />
                                    {project.isArchived ? 'Désarchiver' : 'Archiver'}
                                  </ContextMenuItem>
                                  {spaces.filter(s => s.id !== space.id).length > 0 && (
                                    <ContextMenuSub>
                                      <ContextMenuSubTrigger>
                                        <FolderInput className="w-4 h-4 mr-2" />
                                        Déplacer vers
                                      </ContextMenuSubTrigger>
                                      <ContextMenuSubContent className="w-44">
                                        {spaces.filter(s => s.id !== space.id).map(s => (
                                          <ContextMenuItem key={s.id} onClick={() => moveProject(project.id, s.id)}>
                                            <span className="mr-2">{s.icon}</span>
                                            {s.name}
                                          </ContextMenuItem>
                                        ))}
                                      </ContextMenuSubContent>
                                    </ContextMenuSub>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onClick={() => setDeleteConfirm({ type: 'project', id: project.id, name: project.name })}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer
                                      </ContextMenuItem>
                                    </>
                                  )}
                                </ContextMenuContent>
                              </ContextMenu>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className={`p-2 -m-1 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-opacity mr-0.5 ${isMobile ? 'opacity-80' : 'opacity-40 group-hover/project:opacity-100'}`}
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => setMembersDialogProject({ id: project.id, name: project.name })}>
                                    <Users className="w-4 h-4 mr-2" />
                                    Responsables
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setEditingProjectId(project.id);
                                    setEditingProjectName(project.name);
                                  }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Renommer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicateProject(project.id)}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Dupliquer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => archiveProject(project.id)}>
                                    <Archive className="w-4 h-4 mr-2" />
                                    {project.isArchived ? 'Désarchiver' : 'Archiver'}
                                  </DropdownMenuItem>
                                  {spaces.filter(s => s.id !== space.id).length > 0 && (
                                    <DropdownMenuSub>
                                      <DropdownMenuSubTrigger>
                                        <FolderInput className="w-4 h-4 mr-2" />
                                        Déplacer vers
                                      </DropdownMenuSubTrigger>
                                      <DropdownMenuSubContent className="w-44">
                                        {spaces.filter(s => s.id !== space.id).map(s => (
                                          <DropdownMenuItem key={s.id} onClick={() => moveProject(project.id, s.id)}>
                                            <span className="mr-2">{s.icon}</span>
                                            {s.name}
                                          </DropdownMenuItem>
                                        ))}
                                      </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                  )}
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => setDeleteConfirm({ type: 'project', id: project.id, name: project.name })}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SortableProject>
                          )
                        ))}
                      </SortableContext>
                    </DndContext>

                    {/* Add project form */}
                    {addingProjectForSpace === space.id && (
                      <div className="mt-1 bg-sidebar-hover rounded-md p-2 space-y-2">
                        <input
                          autoFocus
                          value={newProjectName}
                          onChange={e => setNewProjectName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddProject(space.id);
                            if (e.key === 'Escape') { setAddingProjectForSpace(null); setNewProjectName(''); setNewProjectMemberIds([]); }
                          }}
                          placeholder="Nom du projet..."
                          className="w-full text-sm bg-sidebar-bg border border-sidebar-border-color rounded-md px-2 py-1 outline-none text-sidebar-fg-bright placeholder:text-sidebar-fg"
                        />
                        <div className="flex gap-1 flex-wrap">
                          {PROJECT_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => setNewProjectColor(color)}
                              className={`w-5 h-5 rounded-sm transition-all ${newProjectColor === color ? 'ring-2 ring-primary ring-offset-1 ring-offset-sidebar-bg' : ''}`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        {/* Responsables du projet */}
                        <div className="space-y-1">
                          <span className="text-xs text-sidebar-fg">Responsables :</span>
                          <div className="flex gap-1 flex-wrap max-h-20 overflow-y-auto">
                            {teamMembers.map(member => {
                              const selected = newProjectMemberIds.includes(member.id);
                              return (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => setNewProjectMemberIds(prev =>
                                    selected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                                  )}
                                  className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full transition-all border ${
                                    selected
                                      ? 'bg-primary/20 border-primary text-primary'
                                      : 'bg-sidebar-bg border-sidebar-border-color text-sidebar-fg hover:border-primary/50'
                                  }`}
                                >
                                  <span
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: member.avatarColor }}
                                  >
                                    {member.name.charAt(0).toUpperCase()}
                                  </span>
                                  <span className="truncate max-w-[80px]">{member.name.split(' ')[0]}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddProject(space.id)}
                            disabled={!newProjectName.trim()}
                            className="flex-1 text-xs bg-primary text-primary-foreground rounded-md py-1 font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            Créer
                          </button>
                          <button
                            onClick={() => { setAddingProjectForSpace(null); setNewProjectName(''); setNewProjectMemberIds([]); }}
                            className="flex-1 text-xs text-sidebar-fg rounded-md py-1 hover:bg-sidebar-bg"
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SortableSpace>
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* Archives */}
      <ArchivesSection />

      {/* Team + Settings — collapsible on mobile, closed by default */}
      {isMobile ? (
        <Collapsible defaultOpen={false}>
          <div className="px-4 py-2 border-t border-sidebar-border-color">
            <CollapsibleTrigger className="flex items-center justify-between w-full text-xs font-semibold text-sidebar-fg uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Équipe & Paramètres</span>
              <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="px-4 pb-2">
              <div className="flex gap-1 flex-wrap">
                {teamMembers.map(m => (
                  <div key={m.id} className="relative">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt={m.name} title={`${m.name} — ${m.role}`} className="w-8 h-8 rounded-full object-cover cursor-default" />
                    ) : (
                      <div title={`${m.name} — ${m.role}`} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default" style={{ backgroundColor: m.avatarColor, color: 'white' }}>
                        {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                    )}
                    {isOnline(m.id) && (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-sidebar-border-color">
              <CurrentUserBadge />
              <ThemeSwitcher />
              <div className="flex items-center gap-1 mt-1">
                <AdminSettingsLink />
                <InstallAppLink />
                <LogoutButton />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        <>
          {/* Team */}
          <div className="px-4 py-3 border-t border-sidebar-border-color">
            <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider mb-2">Équipe</p>
            <div className="flex gap-1 flex-wrap">
              {teamMembers.map(m => (
                <div key={m.id} className="relative">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} title={`${m.name} — ${m.role}`} className="w-8 h-8 rounded-full object-cover cursor-default" />
                  ) : (
                    <div title={`${m.name} — ${m.role}`} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default" style={{ backgroundColor: m.avatarColor, color: 'white' }}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                  {isOnline(m.id) && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-card rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Current user + Settings + Logout */}
          <div className="px-4 py-3 border-t border-sidebar-border-color mt-auto">
            <CurrentUserBadge />
            <ThemeSwitcher />
            <div className="flex items-center gap-1 mt-1">
              <AdminSettingsLink />
              <InstallAppLink />
              <LogoutButton />
            </div>
          </div>
        </>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {deleteConfirm?.type === 'space' ? (() => {
                  const spaceProjects = getProjectsForSpace(deleteConfirm.id);
                  const spaceTasks = tasks.filter(t => {
                    const list = lists.find(l => l.id === t.listId);
                    return list && spaceProjects.some(p => p.id === list.projectId);
                  });
                  return (
                    <>
                      <p>Supprimer l'espace <strong>« {deleteConfirm.name} »</strong> ?</p>
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm space-y-1">
                        <p className="font-medium text-destructive">Éléments qui seront supprimés :</p>
                        <ul className="list-disc list-inside text-muted-foreground">
                          <li>{spaceProjects.length} projet{spaceProjects.length > 1 ? 's' : ''}</li>
                          <li>{spaceTasks.length} tâche{spaceTasks.length > 1 ? 's' : ''}</li>
                        </ul>
                      </div>
                      <p className="text-sm text-muted-foreground">Cette action est <strong>irréversible</strong>.</p>
                    </>
                  );
                })() : (() => {
                  const projectTasks = deleteConfirm ? getTasksForProject(deleteConfirm.id) : [];
                  return (
                    <>
                      <p>Supprimer le projet <strong>« {deleteConfirm?.name} »</strong> ?</p>
                      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm space-y-1">
                        <p className="font-medium text-destructive">Éléments qui seront supprimés :</p>
                        <ul className="list-disc list-inside text-muted-foreground">
                          <li>{projectTasks.length} tâche{projectTasks.length > 1 ? 's' : ''}</li>
                        </ul>
                      </div>
                      <p className="text-sm text-muted-foreground">Cette action est <strong>irréversible</strong>.</p>
                    </>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                const dc = deleteConfirm;
                if (dc?.type === 'space') {
                  deleteSpace(dc.id);
                } else if (dc?.type === 'project') {
                  deleteProject(dc.id);
                }
                setDeleteConfirm(null);
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Space access dialog */}
      {accessDialogSpace && (
        <SpaceAccessDialog
          open={!!accessDialogSpace}
          onOpenChange={(open) => { if (!open) setAccessDialogSpace(null); }}
          spaceId={accessDialogSpace.id}
          spaceName={accessDialogSpace.name}
          isPrivate={accessDialogSpace.isPrivate}
          onUpdate={refreshSpaceAccess}
        />
      )}

      {/* Project members dialog */}
      {membersDialogProject && (
        <ProjectMembersDialog
          open={!!membersDialogProject}
          onOpenChange={(open) => { if (!open) setMembersDialogProject(null); }}
          projectId={membersDialogProject.id}
          projectName={membersDialogProject.name}
        />
      )}
    </div>
    </>
  );
}

function CollapsedChatIcon() {
  const navigate = useNavigate();
  const { totalUnread } = useChatNotifications();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate('/chat')}
          className="relative p-2 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors"
        >
          <MessageCircle className="w-4.5 h-4.5" />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-label flex items-center justify-center font-bold">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Chat d'équipe{totalUnread > 0 ? ` (${totalUnread})` : ''}</TooltipContent>
    </Tooltip>
  );
}

function ArchivesSection() {
  const { archivedSpaces, archivedProjects, archiveSpace, archiveProject } = useApp();
  const [expanded, setExpanded] = useState(false);

  const totalArchived = archivedSpaces.length + archivedProjects.length;
  if (totalArchived === 0) return null;

  return (
    <div className="px-4 py-2 border-t border-sidebar-border-color">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-xs font-semibold text-sidebar-fg uppercase tracking-wider hover:text-sidebar-fg-bright transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Archive className="w-3.5 h-3.5" />
        <span>Archives</span>
        <span className="ml-auto text-[10px] bg-sidebar-hover rounded-full px-1.5 py-0.5">{totalArchived}</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 pl-2">
          {archivedSpaces.map(space => (
            <div key={space.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg group">
              <span>{space.icon}</span>
              <span className="flex-1 truncate opacity-60">{space.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => archiveSpace(space.id)}
                    className="opacity-0 group-hover:opacity-100 text-sidebar-fg hover:text-sidebar-fg-bright transition-opacity p-0.5"
                    title="Désarchiver"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Désarchiver</TooltipContent>
              </Tooltip>
            </div>
          ))}
          {archivedProjects.map(project => (
            <div key={project.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg group ml-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
              <span className="flex-1 truncate opacity-60">{project.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => archiveProject(project.id)}
                    className="opacity-0 group-hover:opacity-100 text-sidebar-fg hover:text-sidebar-fg-bright transition-opacity p-0.5"
                    title="Désarchiver"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Désarchiver</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ChatLink({ handleNavClick }: { handleNavClick: () => void }) {
  const navigate = useNavigate();
  const { totalUnread } = useChatNotifications();

  return (
    <button
      onClick={() => { navigate('/chat'); handleNavClick(); }}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors mt-1"
    >
      <MessageCircle className="w-4 h-4" />
      Chat d'équipe
      {totalUnread > 0 && (
        <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      )}
    </button>
  );
}
function ThemeSwitcher() {
  const { theme, setTheme, palette, setPalette } = useThemeMode();
  const options: { key: 'light' | 'dark' | 'mixed'; label: string; title: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Clair', title: 'Thème clair', icon: <Sun className="w-3.5 h-3.5" /> },
    { key: 'dark', label: 'Sombre', title: 'Thème sombre', icon: <Moon className="w-3.5 h-3.5" /> },
    { key: 'mixed', label: 'Mixte', title: 'Sidebar sombre, contenu clair', icon: <SunMoon className="w-3.5 h-3.5" /> },
  ];

  const palettes: { key: typeof palette; label: string; colors: string[] }[] = [
    { key: 'clubroom', label: 'Obsidian & Gold', colors: ['#13121A', '#C9A84C'] },
    { key: 'neutrals', label: 'Sable & Pierre', colors: ['#171513', '#A08868'] },
    { key: 'sapphire', label: 'Sapphire Depth', colors: ['#0C1018', '#2DD4BF'] },
    { key: 'cinematic', label: 'Cinematic Glow', colors: ['#0E0A1C', '#7C5CED'] },
    { key: 'teal', label: 'Ocean Teal', colors: ['#0A1518', '#14B8A6'] },
    { key: 'bento2026', label: 'Bento 2026', colors: ['#f5f0e8', '#2d3a2e'] },
    { key: 'bentoOcean', label: 'Bento Ocean', colors: ['#eef3f8', '#1e3a5f'] },
    { key: 'bentoRose', label: 'Bento Rose', colors: ['#f8f0f0', '#5c2434'] },
    { key: 'bentoAmber', label: 'Bento Amber', colors: ['#f5efe5', '#d4a04a'] },
    { key: 'liquidGlass', label: 'Liquid Glass', colors: ['#e8f4ff', '#6366f1'] },
    { key: 'liquidGlassOcean', label: 'LG Ocean', colors: ['#38bdf8', '#0284c7'] },
    { key: 'liquidGlassAurora', label: 'LG Aurora', colors: ['#34d399', '#059669'] },
    { key: 'liquidGlassRose', label: 'LG Rose', colors: ['#f472b6', '#be185d'] },
    { key: 'liquidGlassAmber', label: 'LG Amber', colors: ['#fbbf24', '#d97706'] },
    { key: 'liquidGlassViolet', label: 'LG Violet', colors: ['#a78bfa', '#7c3aed'] },
    { key: 'liquidGlassCoral', label: 'LG Coral', colors: ['#fb7185', '#dc2626'] },
    { key: 'liquidGlassSlate', label: 'LG Slate', colors: ['#94a3b8', '#475569'] },
    { key: 'liquidGlassMidnight', label: 'LG Midnight', colors: ['#6366f1', '#1e1b4b'] },
  ];

  return (
    <div className="space-y-1 mb-1">
      <div className="flex items-center gap-0.5 px-1 py-1 rounded-md bg-sidebar-hover/50">
        {options.map(opt => (
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors flex-1 justify-center ${
              theme === opt.key
                ? 'bg-sidebar-active text-white'
                : 'text-sidebar-fg hover:text-sidebar-fg-bright'
            }`}
            title={opt.title}
          >
            {opt.icon}
            <span className="hidden md:inline">{opt.label}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 px-1 py-1 rounded-md bg-sidebar-hover/50">
        {palettes.map(p => (
          <Tooltip key={p.key}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setPalette(p.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-1 rounded transition-all ${
                  palette === p.key
                    ? 'ring-1 ring-primary bg-sidebar-active/60'
                    : 'hover:bg-sidebar-hover'
                }`}
              >
                {p.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">{p.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
function CurrentUserBadge() {
  const { teamMemberId } = useAuth();
  const { teamMembers } = useApp();
  const member = teamMembers.find(m => m.id === teamMemberId);

  if (!member) return null;

  return (
    <div className="flex items-center gap-2.5 mb-2 px-2 py-1.5">
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={member.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
      ) : (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: member.avatarColor, color: 'white' }}
        >
          {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-sidebar-fg-bright truncate">{member.name}</p>
        <p className="text-xs text-sidebar-fg truncate">{member.role}</p>
      </div>
    </div>
  );
}

function AdminSettingsLink() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  if (!isAdmin) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/settings')}
             className="flex items-center justify-center p-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
             title="Administration"
           >
             <Settings className="w-4 h-4" />
           </button>
         </TooltipTrigger>
         <TooltipContent side="top">
           Administration
         </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
function InstallAppLink() {
  const navigate = useNavigate();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate('/install')}
             className="flex items-center justify-center p-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
             title="Installer l'app"
           >
             <ArrowDownToLine className="w-4 h-4" />
           </button>
         </TooltipTrigger>
         <TooltipContent side="top">
           Installer l'app
         </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const LogoutButton = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<'button'>>((props, ref) => {
  const { signOut } = useAuth();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            onClick={signOut}
             className="flex items-center justify-center p-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
             title="Déconnexion"
             {...props}
           >
             <LogOut className="w-4 h-4" />
           </button>
         </TooltipTrigger>
         <TooltipContent side="top">
           Déconnexion
         </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
LogoutButton.displayName = 'LogoutButton';

// Sortable wrapper for spaces
function SortableSpace({ space, children }: { space: { id: string }; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: space.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="mb-1 relative group/drag">
      <Tooltip>
        <TooltipTrigger asChild>
          <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover/drag:opacity-60 cursor-grab active:cursor-grabbing z-10 p-0.5 hidden md:block">
            <GripVertical className="w-3 h-3 text-sidebar-fg" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">Glisser pour réordonner</TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}

// Sortable wrapper for projects
function SortableProject({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center group/project relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2.5 opacity-0 group-hover/project:opacity-60 cursor-grab active:cursor-grabbing z-10 p-0.5 hidden md:block">
            <GripVertical className="w-3 h-3 text-sidebar-fg" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs">Glisser vers un espace pour déplacer</TooltipContent>
      </Tooltip>
      {children}
    </div>
  );
}
