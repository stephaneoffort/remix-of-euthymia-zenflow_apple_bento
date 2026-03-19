
-- Track last read timestamp per member per category
CREATE TABLE public.chat_read_status (
  member_id TEXT NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES public.chat_categories(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, category_id)
);

-- Enable RLS
ALTER TABLE public.chat_read_status ENABLE ROW LEVEL SECURITY;

-- Everyone can read (needed to compute unread counts)
CREATE POLICY "Read status viewable by everyone"
  ON public.chat_read_status FOR SELECT TO public
  USING (true);

-- Authenticated users can upsert their own read status
CREATE POLICY "Users can insert own read status"
  ON public.chat_read_status FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own read status"
  ON public.chat_read_status FOR UPDATE TO authenticated
  USING (true);
