CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Allow update on task_reminders for triggered_at resets
CREATE POLICY "Task reminders updatable by everyone" ON public.task_reminders FOR UPDATE TO public USING (true);

-- Reset triggered_at when a reminder is re-created (delete+insert cycle handles this already)