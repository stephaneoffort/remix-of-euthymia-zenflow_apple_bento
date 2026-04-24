-- 1. Table pour les liens de référence cross-project entre tâches
CREATE TABLE IF NOT EXISTS public.task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id text NOT NULL,
  linked_task_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_links_no_self CHECK (task_id <> linked_task_id),
  CONSTRAINT task_links_unique UNIQUE (task_id, linked_task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON public.task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_linked_task_id ON public.task_links(linked_task_id);

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_links_select" ON public.task_links FOR SELECT USING (true);
CREATE POLICY "task_links_insert" ON public.task_links FOR INSERT WITH CHECK (true);
CREATE POLICY "task_links_delete" ON public.task_links FOR DELETE USING (true);

-- 2. Fonction pour vérifier que toutes les dépendances bloquantes sont terminées
CREATE OR REPLACE FUNCTION public.check_task_dependencies_done()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  blocking_count int;
  blocking_titles text;
BEGIN
  -- Seulement quand on passe à 'done'
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status <> 'done') THEN
    SELECT count(*), string_agg(t.title, ', ')
      INTO blocking_count, blocking_titles
      FROM public.task_dependencies d
      JOIN public.tasks t ON t.id = d.depends_on_id
     WHERE d.task_id = NEW.id
       AND t.status <> 'done';

    IF blocking_count > 0 THEN
      RAISE EXCEPTION 'BLOCKED_BY_DEPENDENCIES: % tâche(s) non terminée(s): %', blocking_count, blocking_titles
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_task_dependencies_done ON public.tasks;
CREATE TRIGGER trg_check_task_dependencies_done
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_task_dependencies_done();