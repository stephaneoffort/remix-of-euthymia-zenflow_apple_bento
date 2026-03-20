
CREATE TABLE public.dm_read_status (
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  conversation_id text NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, conversation_id)
);

ALTER TABLE public.dm_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM read status viewable by authenticated" ON public.dm_read_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM read status insertable by authenticated" ON public.dm_read_status FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "DM read status updatable by authenticated" ON public.dm_read_status FOR UPDATE TO authenticated USING (true);
