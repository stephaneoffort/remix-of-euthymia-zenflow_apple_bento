
CREATE TABLE public.dm_reactions (
  id text NOT NULL DEFAULT ('dr_' || gen_random_uuid()::text) PRIMARY KEY,
  message_id text NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, member_id, emoji)
);

ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "DM reactions viewable by authenticated" ON public.dm_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM reactions insertable by authenticated" ON public.dm_reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "DM reactions deletable by authenticated" ON public.dm_reactions FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;
