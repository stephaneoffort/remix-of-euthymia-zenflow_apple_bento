import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, LayoutGrid, List, Calendar, AlertCircle, Clock, User, Flame, PanelLeftClose, PanelLeft, LogOut, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
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

const SPACE_ICONS = ['📁', '🚀', '💡', '🎯', '📊', '🛠️', '📚', '🌟', '🧘', '🎨'];
const PROJECT_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];

export default function AppSidebar() {
  const {
    spaces, selectedProjectId, setSelectedProjectId,
    selectedView, setSelectedView, quickFilter, setQuickFilter,
    getProjectsForSpace, teamMembers, sidebarCollapsed, setSidebarCollapsed,
    tasks, addSpace, addProject,
  } = useApp();
  const isMobile = useIsMobile();

  const [expandedSpaces, setExpandedSpaces] = useState<Set<string>>(new Set(spaces.map(s => s.id)));
  const [addingSpace, setAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceIcon, setNewSpaceIcon] = useState('📁');
  const [addingProjectForSpace, setAddingProjectForSpace] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);

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

  const overdueCount = tasks.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.dueDate && t.dueDate < today && t.status !== 'done';
  }).length;

  const handleNavClick = () => {
    if (isMobile) setSidebarCollapsed(true);
  };

  const handleAddSpace = () => {
    if (!newSpaceName.trim()) return;
    addSpace(newSpaceName.trim(), newSpaceIcon);
    setNewSpaceName('');
    setNewSpaceIcon('📁');
    setAddingSpace(false);
  };

  const handleAddProject = (spaceId: string) => {
    if (!newProjectName.trim()) return;
    addProject(newProjectName.trim(), spaceId, newProjectColor);
    setNewProjectName('');
    setNewProjectColor(PROJECT_COLORS[0]);
    setAddingProjectForSpace(null);
  };

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
    <>
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}
      <div className={`${isMobile ? 'fixed inset-y-0 left-0 z-50' : ''} w-64 bg-sidebar-bg flex flex-col border-r border-sidebar-border-color shrink-0 h-screen`}>
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
      </div>

      {/* Spaces & Projects */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3">
        <div className="flex items-center justify-between px-2 mb-2">
          <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider">Espaces</p>
          <button
            onClick={() => setAddingSpace(true)}
            className="p-0.5 rounded hover:bg-sidebar-hover text-sidebar-fg transition-colors"
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
                  className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-colors ${
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
                if (e.key === 'Escape') { setAddingSpace(false); setNewSpaceName(''); }
              }}
              placeholder="Nom de l'espace..."
              className="w-full text-sm bg-sidebar-bg border border-sidebar-border-color rounded-md px-2 py-1 outline-none text-sidebar-fg-bright placeholder:text-sidebar-fg"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAddSpace}
                disabled={!newSpaceName.trim()}
                className="flex-1 text-xs bg-primary text-primary-foreground rounded-md py-1 font-medium hover:opacity-90 disabled:opacity-50"
              >
                Créer
              </button>
              <button
                onClick={() => { setAddingSpace(false); setNewSpaceName(''); }}
                className="flex-1 text-xs text-sidebar-fg rounded-md py-1 hover:bg-sidebar-bg"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {spaces.map(space => (
          <div key={space.id} className="mb-1">
            <div className="flex items-center group">
              <button
                onClick={() => toggleSpace(space.id)}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
              >
                {expandedSpaces.has(space.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>{space.icon}</span>
                <span className="font-medium">{space.name}</span>
              </button>
              <button
                onClick={() => setAddingProjectForSpace(space.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-sidebar-hover text-sidebar-fg transition-all mr-1"
                title="Ajouter un projet"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {expandedSpaces.has(space.id) && (
              <div className="ml-4">
                {getProjectsForSpace(space.id).map(project => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setQuickFilter('all');
                      handleNavClick();
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
          </div>
        ))}
      </div>

      {/* Team */}
      <div className="px-4 py-3 border-t border-sidebar-border-color">
        <p className="text-xs font-semibold text-sidebar-fg uppercase tracking-wider mb-2">Équipe</p>
        <div className="flex gap-1 flex-wrap">
          {teamMembers.map(m => (
            m.avatarUrl ? (
              <img
                key={m.id}
                src={m.avatarUrl}
                alt={m.name}
                title={`${m.name} — ${m.role}`}
                className="w-8 h-8 rounded-full object-cover cursor-default"
              />
            ) : (
              <div
                key={m.id}
                title={`${m.name} — ${m.role}`}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold cursor-default"
                style={{ backgroundColor: m.avatarColor, color: 'white' }}
              >
                {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            )
          ))}
        </div>
      </div>

      {/* Current user + Settings + Logout */}
      <div className="px-4 py-3 border-t border-sidebar-border-color mt-auto">
        <CurrentUserBadge />
        <AdminSettingsLink />
        <LogoutButton />
      </div>
    </div>
    </>
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
    <button
      onClick={() => navigate('/settings')}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors mb-0.5"
    >
      <Settings className="w-4 h-4" />
      <span>Administration</span>
    </button>
  );
}

function LogoutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={signOut}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors"
    >
      <LogOut className="w-4 h-4" />
      <span>Déconnexion</span>
    </button>
  );
}
