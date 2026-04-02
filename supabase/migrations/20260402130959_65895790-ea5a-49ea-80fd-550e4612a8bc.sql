
CREATE TABLE public.task_shares (
  id text NOT NULL DEFAULT ('ts_' || gen_random_uuid()::text) PRIMARY KEY,
  task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_member_id text NOT NULL,
  target_member_id text,
  method text NOT NULL,
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.task_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task shares viewable by everyone" ON public.task_shares FOR SELECT USING (true);
CREATE POLICY "Task shares insertable by everyone" ON public.task_shares FOR INSERT WITH CHECK (true);
CREATE POLICY "Task shares deletable by everyone" ON public.task_shares FOR DELETE USING (true);
