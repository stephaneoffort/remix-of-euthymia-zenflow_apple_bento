
CREATE TABLE IF NOT EXISTS public.user_sync_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_calendar_id TEXT DEFAULT NULL,
  task_calendar_label TEXT DEFAULT NULL,
  auto_sync_tasks BOOLEAN DEFAULT TRUE,
  auto_sync_subtasks BOOLEAN DEFAULT TRUE,
  sync_tasks_without_date BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_sync_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_prefs_own" ON public.user_sync_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
