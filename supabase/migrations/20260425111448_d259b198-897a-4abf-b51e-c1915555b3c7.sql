-- Table de modèles de tâches (globaux)
CREATE TABLE public.task_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'normal',
  tags text[] NOT NULL DEFAULT '{}'::text[],
  due_offset_days integer,
  subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

-- Tout le monde authentifié peut lire (bibliothèque partagée)
CREATE POLICY "Templates viewable by authenticated"
ON public.task_templates FOR SELECT
TO authenticated
USING (true);

-- Tout le monde authentifié peut créer
CREATE POLICY "Templates insertable by authenticated"
ON public.task_templates FOR INSERT
TO authenticated
WITH CHECK (true);

-- Le créateur ou un admin peut modifier
CREATE POLICY "Templates updatable by creator or admin"
ON public.task_templates FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Le créateur ou un admin peut supprimer
CREATE POLICY "Templates deletable by creator or admin"
ON public.task_templates FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_task_templates_updated_at
BEFORE UPDATE ON public.task_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();