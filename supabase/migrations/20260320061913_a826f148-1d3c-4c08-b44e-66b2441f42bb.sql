
-- Direct conversations table
CREATE TABLE public.direct_conversations (
  id text NOT NULL DEFAULT ('dc_' || gen_random_uuid()::text) PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Conversation members (who's in which DM)
CREATE TABLE public.direct_conversation_members (
  conversation_id text NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  PRIMARY KEY (conversation_id, member_id)
);

-- Direct messages
CREATE TABLE public.direct_messages (
  id text NOT NULL DEFAULT ('dm_' || gen_random_uuid()::text) PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachment_url text,
  attachment_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (viewable/insertable by authenticated users)
CREATE POLICY "DM conversations viewable by authenticated" ON public.direct_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM conversations insertable by authenticated" ON public.direct_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "DM conversations updatable by authenticated" ON public.direct_conversations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "DM members viewable by authenticated" ON public.direct_conversation_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM members insertable by authenticated" ON public.direct_conversation_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "DM members deletable by authenticated" ON public.direct_conversation_members FOR DELETE TO authenticated USING (true);

CREATE POLICY "DM messages viewable by authenticated" ON public.direct_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "DM messages insertable by authenticated" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "DM messages deletable by authenticated" ON public.direct_messages FOR DELETE TO authenticated USING (true);

-- Enable realtime for direct messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
