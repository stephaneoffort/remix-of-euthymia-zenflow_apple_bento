
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS conference_id TEXT;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS has_meet BOOLEAN DEFAULT FALSE;
