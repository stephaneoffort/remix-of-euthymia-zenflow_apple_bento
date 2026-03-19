import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Task, Space, Project, TaskList, TeamMember, ViewType, QuickFilter, Status, Priority } from '@/types';
import { SPACES, PROJECTS, LISTS, INITIAL_TASKS, TEAM_MEMBERS } from '@/data/sampleData';

interface AppState {
  spaces: Space[];
  projects: Project[];
  lists: TaskList[];
  tasks: Task[];
  teamMembers: TeamMember[];
  selectedProjectId: string | null;
  selectedView: ViewType;
  quickFilter: QuickFilter;
  selectedTaskId: string | null;
  sidebarCollapsed: boolean;
}

interface AppContextType extends AppState {
  setSelectedProjectId: (id: string | null) => void;
  setSelectedView: (view: ViewType) => void;
  setQuickFilter: (filter: QuickFilter) => void;
  setSelectedTaskId: (id: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: Status) => void;
  getSubtasks: (taskId: string) => Task[];
  getTaskById: (id: string) => Task | undefined;
  getListsForProject: (projectId: string) => TaskList[];
  getProjectsForSpace: (spaceId: string) => Project[];
  getTasksForProject: (projectId: string) => Task[];
  getFilteredTasks: () => Task[];
  getMemberById: (id: string) => TeamMember | undefined;
  getTaskBreadcrumb: (taskId: string) => Task[];
}

const AppContext = createContext<AppContextType | null>(null);

let nextId = 100;
const genId = () => `t_${nextId++}`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>('p1');
  const [selectedView, setSelectedView] = useState<ViewType>('kanban');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'order'>) => {
    setTasks(prev => [...prev, { ...task, id: genId(), createdAt: new Date().toISOString(), order: prev.length }]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const idsToRemove = new Set<string>();
      const collectChildren = (parentId: string) => {
        idsToRemove.add(parentId);
        prev.filter(t => t.parentTaskId === parentId).forEach(t => collectChildren(t.id));
      };
      collectChildren(id);
      return prev.filter(t => !idsToRemove.has(t.id));
    });
  }, []);

  const moveTask = useCallback((taskId: string, newStatus: Status) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  }, []);

  const getSubtasks = useCallback((taskId: string) => {
    return tasks.filter(t => t.parentTaskId === taskId).sort((a, b) => a.order - b.order);
  }, [tasks]);

  const getTaskById = useCallback((id: string) => tasks.find(t => t.id === id), [tasks]);

  const getListsForProject = useCallback((projectId: string) =>
    LISTS.filter(l => l.projectId === projectId).sort((a, b) => a.order - b.order), []);

  const getProjectsForSpace = useCallback((spaceId: string) =>
    PROJECTS.filter(p => p.spaceId === spaceId).sort((a, b) => a.order - b.order), []);

  const getTasksForProject = useCallback((projectId: string) => {
    const listIds = new Set(LISTS.filter(l => l.projectId === projectId).map(l => l.id));
    return tasks.filter(t => listIds.has(t.listId) && !t.parentTaskId);
  }, [tasks]);

  const getMemberById = useCallback((id: string) => TEAM_MEMBERS.find(m => m.id === id), []);

  const getTaskBreadcrumb = useCallback((taskId: string): Task[] => {
    const trail: Task[] = [];
    let current = tasks.find(t => t.id === taskId);
    while (current) {
      trail.unshift(current);
      current = current.parentTaskId ? tasks.find(t => t.id === current!.parentTaskId) : undefined;
    }
    return trail;
  }, [tasks]);

  const getFilteredTasks = useCallback(() => {
    let filtered = tasks.filter(t => !t.parentTaskId);
    const today = new Date().toISOString().split('T')[0];

    if (selectedProjectId && quickFilter === 'all') {
      const listIds = new Set(LISTS.filter(l => l.projectId === selectedProjectId).map(l => l.id));
      filtered = filtered.filter(t => listIds.has(t.listId));
    }

    switch (quickFilter) {
      case 'my_tasks':
        filtered = filtered.filter(t => t.assigneeIds.includes('tm1'));
        break;
      case 'urgent':
        filtered = filtered.filter(t => t.priority === 'urgent');
        break;
      case 'today':
        filtered = filtered.filter(t => t.dueDate === today);
        break;
      case 'overdue':
        filtered = filtered.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
        break;
    }
    return filtered;
  }, [tasks, selectedProjectId, quickFilter]);

  const value = useMemo(() => ({
    spaces: SPACES,
    projects: PROJECTS,
    lists: LISTS,
    tasks,
    teamMembers: TEAM_MEMBERS,
    selectedProjectId,
    selectedView,
    quickFilter,
    selectedTaskId,
    sidebarCollapsed,
    setSelectedProjectId,
    setSelectedView,
    setQuickFilter,
    setSelectedTaskId,
    setSidebarCollapsed,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    getSubtasks,
    getTaskById,
    getListsForProject,
    getProjectsForSpace,
    getTasksForProject,
    getFilteredTasks,
    getMemberById,
    getTaskBreadcrumb,
  }), [tasks, selectedProjectId, selectedView, quickFilter, selectedTaskId, sidebarCollapsed, addTask, updateTask, deleteTask, moveTask, getSubtasks, getTaskById, getListsForProject, getProjectsForSpace, getTasksForProject, getFilteredTasks, getMemberById, getTaskBreadcrumb]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
