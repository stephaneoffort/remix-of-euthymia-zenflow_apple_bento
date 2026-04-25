import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Priority } from '@/types';

export interface TemplateSubtask {
  title: string;
  priority?: Priority;
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: Priority;
  tags: string[];
  due_offset_days: number | null;
  subtasks: TemplateSubtask[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateInput {
  name: string;
  title: string;
  description?: string;
  priority?: Priority;
  tags?: string[];
  due_offset_days?: number | null;
  subtasks?: TemplateSubtask[];
}

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) {
      setTemplates(
        data.map((d: any) => ({
          ...d,
          subtasks: Array.isArray(d.subtasks) ? d.subtasks : [],
          tags: Array.isArray(d.tags) ? d.tags : [],
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
    const channel = supabase
      .channel('task_templates_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_templates' },
        () => fetchTemplates(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTemplates]);

  const createTemplate = useCallback(async (input: TaskTemplateInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('task_templates').insert({
      name: input.name,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority ?? 'normal',
      tags: input.tags ?? [],
      due_offset_days: input.due_offset_days ?? null,
      subtasks: (input.subtasks ?? []) as any,
      created_by: userData.user?.id ?? null,
    });
    if (error) throw error;
  }, []);

  const updateTemplate = useCallback(
    async (id: string, patch: Partial<TaskTemplateInput>) => {
      const { error } = await supabase
        .from('task_templates')
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.title !== undefined && { title: patch.title }),
          ...(patch.description !== undefined && { description: patch.description }),
          ...(patch.priority !== undefined && { priority: patch.priority }),
          ...(patch.tags !== undefined && { tags: patch.tags }),
          ...(patch.due_offset_days !== undefined && { due_offset_days: patch.due_offset_days }),
          ...(patch.subtasks !== undefined && { subtasks: patch.subtasks as any }),
        })
        .eq('id', id);
      if (error) throw error;
    },
    [],
  );

  const deleteTemplate = useCallback(async (id: string) => {
    const { error } = await supabase.from('task_templates').delete().eq('id', id);
    if (error) throw error;
  }, []);

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, refresh: fetchTemplates };
}
