ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;