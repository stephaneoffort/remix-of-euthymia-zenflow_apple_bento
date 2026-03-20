export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export type Status = 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | (string & {});

export const DEFAULT_STATUSES: Status[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];

export const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  in_review: 'En revue',
  done: 'Terminé',
  blocked: 'Bloqué',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Haute',
  normal: 'Normale',
  low: 'Basse',
};

export interface CustomStatus {
  id: string;
  label: string;
  sortOrder: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  avatarUrl: string | null;
  email: string;
}

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  startDate: string | null;
  assigneeIds: string[];
  tags: string[];
  parentTaskId: string | null;
  listId: string;
  comments: Comment[];
  attachments: Attachment[];
  timeEstimate: number | null; // minutes
  timeLogged: number | null;
  aiSummary: string | null;
  createdAt: string;
  order: number;
}

export interface TaskList {
  id: string;
  name: string;
  projectId: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  spaceId: string;
  color: string;
  order: number;
}

export interface Space {
  id: string;
  name: string;
  icon: string;
  order: number;
  isPrivate: boolean;
}

export interface SpaceMember {
  spaceId: string;
  memberId: string;
}

export interface SpaceManager {
  spaceId: string;
  memberId: string;
}

export type ViewType = 'kanban' | 'list' | 'calendar' | 'workload' | 'mindmap';

export type QuickFilter = 'all' | 'my_tasks' | 'urgent' | 'today' | 'overdue';
