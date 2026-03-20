
CREATE TABLE public.checklist_items (
  id text NOT NULL DEFAULT ('cli_' || gen_random_uuid()::text) PRIMARY KEY,
  task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Checklist items viewable by everyone" ON public.checklist_items FOR SELECT TO public USING (true);
CREATE POLICY "Checklist items insertable by everyone" ON public.checklist_items FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Checklist items updatable by everyone" ON public.checklist_items FOR UPDATE TO public USING (true);
CREATE POLICY "Checklist items deletable by everyone" ON public.checklist_items FOR DELETE TO public USING (true);
