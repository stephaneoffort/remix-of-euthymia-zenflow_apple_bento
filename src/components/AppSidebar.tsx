import React, { useState, useEffect, useCallback } from 'react';
import logoEuthymia from '@/assets/logo_euthymia.jpg';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ChevronRight, ChevronDown, LayoutGrid, AlertCircle, Clock, User, Flame, PanelLeftClose, PanelLeft, LogOut, Plus, Settings, Trash2, GripVertical, MessageCircle, Shield, Crown, Lock, Sun, Moon, SunMoon, MoreHorizontal, Pencil } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { QuickFilter } from '@/types';
import { useChatNotifications } from '@/hooks/useChatNotifications';
import { usePresence } from '@/hooks/usePresence';
import SpaceAccessDialog from '@/components/SpaceAccessDialog';
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
const PROJECT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];

export default function AppSidebar() {
  const {
    spaces, selectedProjectId, setSelectedProjectId, selectedSpaceId, setSelectedSpaceId,
    quickFilter, setQuickFilter,
    getProjectsForSpace, getTasksForProject, teamMembers, sidebarCollapsed, setSidebarCollapsed, lists,
    tasks, addSpace, addProject, renameSpace, renameProject, deleteSpace, deleteProject,
    reorderSpaces, reorderProjects, canAccessSpace, isSpaceManager, getSpaceManagers, refreshSpaceAccess,
  } = useApp();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { isOnline } = usePresence();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin')
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(spaces.map(s => s.id)));
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState('📁');
  const [newSpacePrivate, setNewSpacePrivate] = useState(false);
  const [addingProjectForSpace, setAddingProjectForSpace] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'space' | 'project'; id: string; name: string } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(!isMobile);
  const [accessDialogSpace, setAccessDialogSpace] = useState<{ id: string; name: string; isPrivate: boolean } | null>(null);

  // Filter spaces based on access
  const visibleSpaces = spaces.filter(s => canAccessSpace(s.id));

  useEffect(() => {
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  // Keep new spaces expanded
  useEffect(() => {
    setExpandedSpaces(prev => {
      const next = new Set(prev);
      spaces.forEach(s => next.add(s.id));
      return next;
    });
  }, [spaces]);

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
    addProject(newProjectName.trim(), spaceId, newProjectColor);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setAddingProjectForSpace(null);
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
                      ? 'bg-sidebar-active text-sidebar-fg-bright'
                      : 'text-sidebar-fg hover:bg-sidebar-hover'
                  }`}
                >
                  {f.icon}
                  {f.key === 'overdue' && overdueCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-priority-urgent text-sidebar-fg-bright rounded-full text-[9px] flex items-center justify-center font-bold">
                      {overdueCount > 9 ? '9+' : overdueCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{f.label}</TooltipContent>
            </Tooltip>
          ))}

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
                            ? 'bg-sidebar-active text-sidebar-fg-bright'
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
        className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : ''} w-64 bg-sidebar-bg flex flex-col border-r border-sidebar-border-color shrink-0 h-screen`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-sidebar-border-color">
        <div className="flex items-center gap-2.5">
          <img src={logoEuthymia} alt="Euthymia" className="w-8 h-8 rounded-full object-cover" />
          <div>
            <h1 className="text-sidebar-fg-bright font-bold text-lg leading-tight">Euthymia</h1>
            <p className="text-sidebar-fg text-xs">Gestion de projets</p>
          </div>
        </div>
        <button onClick={() => setSidebarCollapsed(true)} className="p-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors">
          <PanelLeftClose className="w-4 h-4" />
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
            <ChatLink handleNavClick={handleNavClick} />
          </>
        )}
      </div>

      {/* Spaces & Projects */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider">Espaces</p>
          <button
            onClick={() => setAddingSpace(true)}
            className="p-2 -m-1.5 rounded-md hover:bg-sidebar-hover text-sidebar-fg transition-colors"
            title="Ajouter un espace"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

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
                <div className="flex items-center group">
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
                  ) : (
                    <span
                      className={`flex-1 font-medium text-sm cursor-pointer truncate flex items-center gap-1 ${
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
                        className="p-2 -m-1 rounded-md hover:bg-sidebar-hover text-sidebar-fg opacity-40 group-hover:opacity-100 transition-opacity mr-0.5"
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
                              <button
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
                                className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                  selectedProjectId === project.id
                                    ? 'bg-sidebar-active text-sidebar-fg-bright'
                                    : 'text-sidebar-fg hover:bg-sidebar-hover'
                                }`}
                              >
                                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: project.color }} />
                                <span className="flex-1 min-w-0 truncate">{project.name}</span>
                              </button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="p-2 -m-1 rounded-md hover:bg-sidebar-hover text-sidebar-fg opacity-40 group-hover/project:opacity-100 transition-opacity mr-0.5"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => {
                                    setEditingProjectId(project.id);
                                    setEditingProjectName(project.name);
                                  }}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Renommer
                                  </DropdownMenuItem>
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
                            if (e.key === 'Escape') { setAddingProjectForSpace(null); setNewProjectName(''); }
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
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddProject(space.id)}
                            disabled={!newProjectName.trim()}
                            className="flex-1 text-xs bg-primary text-primary-foreground rounded-md py-1 font-medium hover:opacity-90 disabled:opacity-50"
                          >
                            Créer
                          </button>
                          <button
                            onClick={() => { setAddingProjectForSpace(null); setNewProjectName(''); }}
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

      {/* Team */}
      <div className="px-4 py-3 border-t border-sidebar-border-color">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider mb-2">Équipe</p>
        <div className="flex gap-1 flex-wrap">
          {teamMembers.map(m => (
            <div key={m.id} className="relative">
              {m.avatarUrl ? (
                <img
                  src={m.avatarUrl}
                  alt={m.name}
                  title={`${m.name} — ${m.role}`}
                  className="w-8 h-8 rounded-full object-cover cursor-default"
                />
              ) : (
                <div
                  title={`${m.name} — ${m.role}`}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
                  style={{ backgroundColor: m.avatarColor, color: 'white' }}
                >
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
          <LogoutButton />
        </div>
      </div>

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
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center font-bold">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">Chat d'équipe{totalUnread > 0 ? ` (${totalUnread})` : ''}</TooltipContent>
    </Tooltip>
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
  const { theme, setTheme } = useThemeMode();
  const options: { key: 'light' | 'dark' | 'mixed'; label: string; title: string; icon: React.ReactNode }[] = [
    { key: 'light', label: 'Clair', title: 'Thème clair', icon: <Sun className="w-3.5 h-3.5" /> },
    { key: 'dark', label: 'Sombre', title: 'Thème sombre', icon: <Moon className="w-3.5 h-3.5" /> },
    { key: 'mixed', label: 'Mixte', title: 'Sidebar sombre, contenu clair', icon: <SunMoon className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex items-center gap-0.5 px-1 py-1 rounded-md bg-sidebar-hover/50 mb-1">
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
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors md:w-full"
            title="Administration"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">Administration</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="md:hidden">
          Administration
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors md:w-full"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Déconnexion</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="md:hidden">
          Déconnexion
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
      <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 opacity-0 group-hover/drag:opacity-60 cursor-grab active:cursor-grabbing z-10 p-0.5">
        <GripVertical className="w-3 h-3 text-sidebar-fg" />
      </div>
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
      <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2.5 opacity-0 group-hover/project:opacity-60 cursor-grab active:cursor-grabbing z-10 p-0.5">
        <GripVertical className="w-3 h-3 text-sidebar-fg" />
      </div>
      {children}
    </div>
  );
}
