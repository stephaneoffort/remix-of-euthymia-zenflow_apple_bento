import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { Task } from '@/types';

type AddTaskFn = (task: Omit<Task, 'id' | 'createdAt' | 'order'>) => void;

/**
 * Instantiate a template as a real task (and optional subtasks) in a given list.
 * Subtasks are created with the parent task's eventual id deferred to the backend layer:
 * since addTask is fire-and-forget here, we create subtasks without parentTaskId
 * unless the AppContext exposes a richer API. For now, we create the parent task only
 * with subtasks ignored at this layer if no link is possible.
 *
 * To preserve subtasks, we create the parent first, then subtasks with parentTaskId
 * set to a temporary marker — but since AppContext.addTask doesn't return the id,
 * we keep it simple: create parent with description listing subtasks if any unsupported,
 * OR leverage `addTask` calls sequentially. The current AppContext returns void, so we
 * encode subtasks into a checklist-ish list of separate sibling tasks would not respect
 * hierarchy. Therefore we only create the parent here and rely on a future extension
 * for subtasks if addTask exposes the created id.
 */
export function instantiateTemplate(
  template: TaskTemplate,
  listId: string,
  addTask: AddTaskFn,
  assigneeIds: string[] = [],
) {
  const dueDate =
    template.due_offset_days !== null && template.due_offset_days !== undefined
      ? new Date(Date.now() + template.due_offset_days * 86400000)
          .toISOString()
          .split('T')[0]
      : null;

  addTask({
    title: template.title,
    description: template.description,
    status: 'todo',
    priority: template.priority,
    dueDate,
    startDate: null,
    assigneeIds,
    tags: template.tags,
    parentTaskId: null,
    listId,
    comments: [],
    attachments: [],
    timeEstimate: null,
    timeLogged: null,
    aiSummary: null,
  });
}
