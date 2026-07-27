ALTER TABLE public.quick_notes
  ADD COLUMN IF NOT EXISTS remind_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;

CREATE INDEX IF NOT EXISTS quick_notes_pending_reminders_idx
  ON public.quick_notes (remind_at)
  WHERE remind_at IS NOT NULL AND reminded_at IS NULL;