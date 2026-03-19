import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { Task, Space, Project, TaskList, TeamMember, ViewType, QuickFilter, Status, Priority, Comment, Attachment, CustomStatus, DEFAULT_STATUSES, STATUS_LABELS } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export interface AdvancedFilters {
  statuses: string[];
  priorities: string[];
  assigneeIds: string[];
  tags: string[];
}

const EMPTY_FILTERS: AdvancedFilters = { statuses: [], priorities: [], assigneeIds: [], tags: [] };

interface AppState {
  spaces: Space[];
  projects: Project[];
  lists: TaskList[];
  tasks: Task[];
  teamMembers: TeamMember[];
  customStatuses: CustomStatus[];
  allStatuses: string[];
  selectedProjectId: string | null;
  selectedView: ViewType;
  quickFilter: QuickFilter;
  selectedTaskId: string | null;
  sidebarCollapsed: boolean;
  isLoading: boolean;
  advancedFilters: AdvancedFilters;
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
  addAttachment: (taskId: string, name: string, url: string) => void;
  deleteAttachment: (attachmentId: string) => void;
  moveTask: (taskId: string, newStatus: string) => void;
  addSpace: (name: string, icon: string) => void;
  addProject: (name: string, spaceId: string, color: string) => void;
  renameSpace: (id: string, name: string) => void;
  renameProject: (id: string, name: string) => void;
  deleteSpace: (id: string) => void;
  deleteProject: (id: string) => void;
  reorderSpaces: (orderedIds: string[]) => void;
  reorderProjects: (spaceId: string, orderedIds: string[]) => void;
  getSubtasks: (taskId: string) => Task[];
  getTaskById: (id: string) => Task | undefined;
  getListsForProject: (projectId: string) => TaskList[];
  getProjectsForSpace: (spaceId: string) => Project[];
  getTasksForProject: (projectId: string) => Task[];
  getFilteredTasks: () => Task[];
  getMemberById: (id: string) => TeamMember | undefined;
  getTaskBreadcrumb: (taskId: string) => Task[];
  setAdvancedFilters: (filters: AdvancedFilters) => void;
  getStatusLabel: (status: string) => string;
}

const AppContext = createContext<AppContextType | null>(null);

// Helper: convert DB row to Task
function dbToTask(row: any, assigneeIds: string[], comments: Comment[], attachments: Attachment[]): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Status,
    priority: row.priority as Priority,
    dueDate: row.due_date || null,
    startDate: row.start_date || null,
    assigneeIds,
    tags: row.tags || [],
    parentTaskId: row.parent_task_id,
    listId: row.list_id,
    comments,
    attachments,
    timeEstimate: row.time_estimate,
    timeLogged: row.time_logged,
    aiSummary: row.ai_summary,
    createdAt: row.created_at,
    order: row.sort_order,
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { teamMemberId } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>('p1');
  const [selectedView, setSelectedView] = useState<ViewType>('kanban');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);

  // Fetch spaces
  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: async () => {
      const { data, error } = await supabase.from('spaces').select('*').order('sort_order');
      if (error) throw error;
      return data.map(s => ({ id: s.id, name: s.name, icon: s.icon, order: s.sort_order })) as Space[];
    },
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('sort_order');
      if (error) throw error;
      return data.map(p => ({ id: p.id, name: p.name, spaceId: p.space_id, color: p.color, order: p.sort_order })) as Project[];
    },
  });

  // Fetch lists
  const { data: lists = [] } = useQuery({
    queryKey: ['task_lists'],
    queryFn: async () => {
      const { data, error } = await supabase.from('task_lists').select('*').order('sort_order');
      if (error) throw error;
      return data.map(l => ({ id: l.id, name: l.name, projectId: l.project_id, order: l.sort_order })) as TaskList[];
    },
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('*');
      if (error) throw error;
      return data.map(m => ({ id: m.id, name: m.name, role: m.role, avatarColor: m.avatar_color, avatarUrl: m.avatar_url, email: m.email })) as TeamMember[];
    },
  });

  // Fetch custom statuses
  const { data: customStatuses = [] } = useQuery({
    queryKey: ['custom_statuses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('custom_statuses').select('*').order('sort_order');
      if (error) throw error;
      return data.map(s => ({ id: s.id, label: s.label, sortOrder: s.sort_order })) as CustomStatus[];
    },
  });

  // Compute all statuses (default + custom)
  const allStatuses = useMemo(() => {
    const custom = customStatuses.map(cs => cs.id);
    return [...DEFAULT_STATUSES, ...custom];
  }, [customStatuses]);

  const getStatusLabel = useCallback((status: string) => {
    if (STATUS_LABELS[status]) return STATUS_LABELS[status];
    const custom = customStatuses.find(cs => cs.id === status);
    return custom?.label || status;
  }, [customStatuses]);

  // Fetch all tasks with assignees, comments, attachments
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const [tasksRes, assigneesRes, commentsRes, attachmentsRes] = await Promise.all([
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('task_assignees').select('*'),
        supabase.from('comments').select('*').order('created_at'),
        supabase.from('attachments').select('*'),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (assigneesRes.error) throw assigneesRes.error;
      if (commentsRes.error) throw commentsRes.error;
      if (attachmentsRes.error) throw attachmentsRes.error;

      // Group assignees by task
      const assigneeMap = new Map<string, string[]>();
      assigneesRes.data.forEach(a => {
        if (!assigneeMap.has(a.task_id)) assigneeMap.set(a.task_id, []);
        assigneeMap.get(a.task_id)!.push(a.member_id);
      });

      // Group comments by task
      const commentMap = new Map<string, Comment[]>();
      commentsRes.data.forEach(c => {
        if (!commentMap.has(c.task_id)) commentMap.set(c.task_id, []);
        commentMap.get(c.task_id)!.push({ id: c.id, authorId: c.author_id, content: c.content, createdAt: c.created_at });
      });

      // Group attachments by task
      const attachmentMap = new Map<string, Attachment[]>();
      attachmentsRes.data.forEach(a => {
        if (!attachmentMap.has(a.task_id)) attachmentMap.set(a.task_id, []);
        attachmentMap.get(a.task_id)!.push({ id: a.id, name: a.name, url: a.url });
      });

      return tasksRes.data.map(row =>
        dbToTask(row, assigneeMap.get(row.id) || [], commentMap.get(row.id) || [], attachmentMap.get(row.id) || [])
      );
    },
  });

  // Add task mutation
  const addTaskMutation = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => {
      const { data, error } = await supabase.from('tasks').insert({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.dueDate,
        start_date: task.startDate,
        parent_task_id: task.parentTaskId,
        list_id: task.listId,
        tags: task.tags,
        time_estimate: task.timeEstimate,
        time_logged: task.timeLogged,
        ai_summary: task.aiSummary,
        sort_order: tasks.length,
      }).select().single();
      if (error) throw error;

      // Insert assignees
      if (task.assigneeIds.length > 0) {
        const { error: aErr } = await supabase.from('task_assignees').insert(
          task.assigneeIds.map(mid => ({ task_id: data.id, member_id: mid }))
        );
        if (aErr) throw aErr;
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const dbUpdates: any = {};
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.timeEstimate !== undefined) dbUpdates.time_estimate = updates.timeEstimate;
      if (updates.timeLogged !== undefined) dbUpdates.time_logged = updates.timeLogged;
      if (updates.aiSummary !== undefined) dbUpdates.ai_summary = updates.aiSummary;

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('tasks').update(dbUpdates).eq('id', id);
        if (error) throw error;
      }

      // Handle assignee changes
      if (updates.assigneeIds !== undefined) {
        await supabase.from('task_assignees').delete().eq('task_id', id);
        if (updates.assigneeIds.length > 0) {
          const { error } = await supabase.from('task_assignees').insert(
            updates.assigneeIds.map(mid => ({ task_id: id, member_id: mid }))
          );
          if (error) throw error;
        }
      }

      // Handle comment additions
      if (updates.comments !== undefined) {
        const existingTask = tasks.find(t => t.id === id);
        const existingIds = new Set(existingTask?.comments.map(c => c.id) || []);
        const newComments = updates.comments.filter(c => !existingIds.has(c.id));
        for (const c of newComments) {
          const { error } = await supabase.from('comments').insert({
            id: c.id,
            task_id: id,
            author_id: c.authorId,
            content: c.content,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Add attachment mutation
  const addAttachmentMutation = useMutation({
    mutationFn: async ({ taskId, name, url }: { taskId: string; name: string; url: string }) => {
      const { error } = await supabase.from('attachments').insert({ task_id: taskId, name, url });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const { error } = await supabase.from('attachments').delete().eq('id', attachmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  // Add space mutation
  const addSpaceMutation = useMutation({
    mutationFn: async ({ name, icon }: { name: string; icon: string }) => {
      const id = `s_${Date.now()}`;
      const { error } = await supabase.from('spaces').insert({
        id,
        name,
        icon,
        sort_order: spaces.length,
      });
      if (error) throw error;
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  // Add project mutation
  const addProjectMutation = useMutation({
    mutationFn: async ({ name, spaceId, color }: { name: string; spaceId: string; color: string }) => {
      const projectId = `p_${Date.now()}`;
      const listId = `l_${Date.now()}`;
      // Create project
      const { error: pErr } = await supabase.from('projects').insert({
        id: projectId,
        name,
        space_id: spaceId,
        color,
        sort_order: projects.length,
      });
      if (pErr) throw pErr;
      // Create default task list
      const { error: lErr } = await supabase.from('task_lists').insert({
        id: listId,
        name: 'Général',
        project_id: projectId,
        sort_order: 0,
      });
      if (lErr) throw lErr;
      return projectId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['task_lists'] });
    },
  });

  const addSpace = useCallback((name: string, icon: string) => {
    addSpaceMutation.mutate({ name, icon });
  }, [addSpaceMutation]);

  const addProject = useCallback((name: string, spaceId: string, color: string) => {
    addProjectMutation.mutate({ name, spaceId, color });
  }, [addProjectMutation]);

  // Rename space mutation
  const renameSpaceMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('spaces').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ['spaces'] });
      const previous = queryClient.getQueryData(['spaces']);
      queryClient.setQueryData(['spaces'], (old: any) =>
        old?.map((s: any) => s.id === id ? { ...s, name } : s)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['spaces'], context?.previous);
      toast.error('Erreur lors du renommage');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  const renameSpace = useCallback((id: string, name: string) => {
    renameSpaceMutation.mutate({ id, name });
  }, [renameSpaceMutation]);

  // Rename project mutation
  const renameProjectMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('projects').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, name }) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData(['projects']);
      queryClient.setQueryData(['projects'], (old: any) =>
        old?.map((p: any) => p.id === id ? { ...p, name } : p)
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['projects'], context?.previous);
      toast.error('Erreur lors du renommage');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const renameProject = useCallback((id: string, name: string) => {
    renameProjectMutation.mutate({ id, name });
  }, [renameProjectMutation]);

  // Delete space mutation (cascade: delete projects, task_lists, tasks)
  const deleteSpaceMutation = useMutation({
    mutationFn: async (id: string) => {
      const spaceProjects = projects.filter(p => p.spaceId === id);
      for (const proj of spaceProjects) {
        const projLists = lists.filter(l => l.projectId === proj.id);
        for (const list of projLists) {
          await supabase.from('task_assignees').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
          await supabase.from('comments').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
          await supabase.from('attachments').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
          await supabase.from('tasks').delete().eq('list_id', list.id);
        }
        await supabase.from('task_lists').delete().eq('project_id', proj.id);
      }
      await supabase.from('projects').delete().eq('space_id', id);
      const { error } = await supabase.from('spaces').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Espace supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const deleteSpace = useCallback((id: string) => {
    deleteSpaceMutation.mutate(id);
  }, [deleteSpaceMutation]);

  // Delete project mutation (cascade: delete task_lists, tasks)
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const projLists = lists.filter(l => l.projectId === id);
      for (const list of projLists) {
        await supabase.from('task_assignees').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
        await supabase.from('comments').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
        await supabase.from('attachments').delete().in('task_id', tasks.filter(t => t.listId === list.id).map(t => t.id));
        await supabase.from('tasks').delete().eq('list_id', list.id);
      }
      await supabase.from('task_lists').delete().eq('project_id', id);
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Projet supprimé');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  const deleteProject = useCallback((id: string) => {
    if (selectedProjectId === id) setSelectedProjectId(null);
    deleteProjectMutation.mutate(id);
  }, [deleteProjectMutation, selectedProjectId]);

  // Reorder spaces mutation
  const reorderSpacesMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('spaces').update({ sort_order: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['spaces'] }),
  });

  const reorderSpaces = useCallback((orderedIds: string[]) => {
    queryClient.setQueryData<Space[]>(['spaces'], old => {
      if (!old) return old;
      return orderedIds.map((id, i) => {
        const s = old.find(sp => sp.id === id)!;
        return { ...s, order: i };
      });
    });
    reorderSpacesMutation.mutate(orderedIds);
  }, [reorderSpacesMutation, queryClient]);

  // Reorder projects mutation
  const reorderProjectsMutation = useMutation({
    mutationFn: async ({ orderedIds }: { spaceId: string; orderedIds: string[] }) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('projects').update({ sort_order: index }).eq('id', id)
      );
      await Promise.all(updates);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const reorderProjects = useCallback((spaceId: string, orderedIds: string[]) => {
    queryClient.setQueryData<Project[]>(['projects'], old => {
      if (!old) return old;
      return old.map(p => {
        const idx = orderedIds.indexOf(p.id);
        return idx >= 0 ? { ...p, order: idx } : p;
      });
    });
    reorderProjectsMutation.mutate({ spaceId, orderedIds });
  }, [reorderProjectsMutation, queryClient]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt' | 'order'>) => {
    addTaskMutation.mutate(task);
  }, [addTaskMutation]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    // Optimistic update for responsiveness
    queryClient.setQueryData<Task[]>(['tasks'], old => {
      if (!old) return old;
      return old.map(t => {
        if (t.id !== id) return t;
        return { ...t, ...updates };
      });
    });
    updateTaskMutation.mutate({ id, updates });
  }, [updateTaskMutation, queryClient]);

  const deleteTask = useCallback((id: string) => {
    deleteTaskMutation.mutate(id);
  }, [deleteTaskMutation]);

  const addAttachment = useCallback((taskId: string, name: string, url: string) => {
    addAttachmentMutation.mutate({ taskId, name, url });
  }, [addAttachmentMutation]);

  const deleteAttachment = useCallback((attachmentId: string) => {
    deleteAttachmentMutation.mutate(attachmentId);
  }, [deleteAttachmentMutation]);

  const moveTask = useCallback((taskId: string, newStatus: string) => {
    updateTask(taskId, { status: newStatus as Status });
  }, [updateTask]);

  const getSubtasks = useCallback((taskId: string) => {
    return tasks.filter(t => t.parentTaskId === taskId).sort((a, b) => a.order - b.order);
  }, [tasks]);

  const getTaskById = useCallback((id: string) => tasks.find(t => t.id === id), [tasks]);

  const getListsForProject = useCallback((projectId: string) =>
    lists.filter(l => l.projectId === projectId).sort((a, b) => a.order - b.order), [lists]);

  const getProjectsForSpace = useCallback((spaceId: string) =>
    projects.filter(p => p.spaceId === spaceId).sort((a, b) => a.order - b.order), [projects]);

  const getTasksForProject = useCallback((projectId: string) => {
    const listIds = new Set(lists.filter(l => l.projectId === projectId).map(l => l.id));
    return tasks.filter(t => listIds.has(t.listId) && !t.parentTaskId);
  }, [tasks, lists]);

  const getMemberById = useCallback((id: string) => teamMembers.find(m => m.id === id), [teamMembers]);

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
      const listIds = new Set(lists.filter(l => l.projectId === selectedProjectId).map(l => l.id));
      filtered = filtered.filter(t => listIds.has(t.listId));
    }

    switch (quickFilter) {
      case 'my_tasks':
        if (teamMemberId) {
          filtered = filtered.filter(t => t.assigneeIds.includes(teamMemberId));
        }
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

    // Advanced filters
    if (advancedFilters.statuses.length > 0) {
      filtered = filtered.filter(t => advancedFilters.statuses.includes(t.status));
    }
    if (advancedFilters.priorities.length > 0) {
      filtered = filtered.filter(t => advancedFilters.priorities.includes(t.priority));
    }
    if (advancedFilters.assigneeIds.length > 0) {
      filtered = filtered.filter(t => t.assigneeIds.some(id => advancedFilters.assigneeIds.includes(id)));
    }
    if (advancedFilters.tags.length > 0) {
      filtered = filtered.filter(t => t.tags.some(tag => advancedFilters.tags.includes(tag)));
    }

    return filtered;
  }, [tasks, selectedProjectId, quickFilter, lists, teamMemberId, advancedFilters]);

  const value = useMemo(() => ({
    spaces,
    projects,
    lists,
    tasks,
    teamMembers,
    customStatuses,
    allStatuses,
    selectedProjectId,
    selectedView,
    quickFilter,
    selectedTaskId,
    sidebarCollapsed,
    isLoading,
    advancedFilters,
    setSelectedProjectId,
    setSelectedView,
    setQuickFilter,
    setSelectedTaskId,
    setSidebarCollapsed,
    setAdvancedFilters,
    addTask,
    updateTask,
    deleteTask,
    addAttachment,
    deleteAttachment,
    moveTask,
    addSpace,
    addProject,
    renameSpace,
    renameProject,
    deleteSpace,
    deleteProject,
    reorderSpaces,
    reorderProjects,
    getSubtasks,
    getTaskById,
    getListsForProject,
    getProjectsForSpace,
    getTasksForProject,
    getFilteredTasks,
    getMemberById,
    getTaskBreadcrumb,
    getStatusLabel,
  }), [spaces, projects, lists, tasks, teamMembers, customStatuses, allStatuses, selectedProjectId, selectedView, quickFilter, selectedTaskId, sidebarCollapsed, isLoading, advancedFilters, addTask, updateTask, deleteTask, moveTask, addSpace, addProject, renameSpace, renameProject, deleteSpace, deleteProject, reorderSpaces, reorderProjects, getSubtasks, getTaskById, getListsForProject, getProjectsForSpace, getTasksForProject, getFilteredTasks, getMemberById, getTaskBreadcrumb, getStatusLabel]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
