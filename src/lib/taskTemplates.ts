import { TaskTemplate } from '@/hooks/useTaskTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Instantiates a template by creating the parent task + its subtasks in the database.
 * Returns the created parent task id (or null on failure).
 */
export async function instantiateTemplate(
  template: TaskTemplate,
  listId: string,
  assigneeIds: string[] = [],
): Promise<string | null> {
  const dueDate =
    template.due_offset_days !== null && template.due_offset_days !== undefined
      ? new Date(Date.now() + template.due_offset_days * 86400000).toISOString()
      : null;

  const parentPayload = {
    title: template.title,
    description: template.description,
    status: 'todo',
    priority: template.priority,
    due_date: dueDate,
    start_date: null,
    parent_task_id: null,
    list_id: listId,
    tags: template.tags,
    sort_order: 0,
  };

  const { data: parent, error } = await supabase
    .from('tasks')
    .insert(parentPayload)
    .select()
    .single();

  if (error || !parent) {
    console.error('Failed to instantiate template parent', error);
    toast.error('Échec de la création depuis le modèle');
    return null;
  }

  if (assigneeIds.length > 0) {
    await supabase
      .from('task_assignees')
      .insert(assigneeIds.map((mid) => ({ task_id: parent.id, member_id: mid })));
  }

  if (template.subtasks && template.subtasks.length > 0) {
    const subtaskRows = template.subtasks.map((st, idx) => ({
      title: st.title,
      description: '',
      status: 'todo',
      priority: st.priority || template.priority,
      parent_task_id: parent.id,
      list_id: listId,
      tags: [],
      sort_order: idx,
    }));
    const { error: subErr } = await supabase.from('tasks').insert(subtaskRows);
    if (subErr) console.error('Failed to insert subtasks', subErr);
  }

  toast.success(`Tâche créée depuis « ${template.name} »`);
  return parent.id;
}
