CREATE TABLE public.task_reminders (
  id text PRIMARY KEY DEFAULT ('tr_' || gen_random_uuid()::text),
  task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('before_start', 'before_end')),
  offset_key text NOT NULL CHECK (offset_key IN ('3d', '1d', '8h', '1h')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, reminder_type, offset_key)
);

ALTER TABLE public.task_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task reminders viewable by everyone" ON public.task_reminders FOR SELECT TO public USING (true);
CREATE POLICY "Task reminders insertable by everyone" ON public.task_reminders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Task reminders deletable by everyone" ON public.task_reminders FOR DELETE TO public USING (true);