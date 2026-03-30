
-- Drop old chat/DM tables in correct FK order
DROP TABLE IF EXISTS public.chat_reactions CASCADE;
DROP TABLE IF EXISTS public.chat_read_status CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.chat_categories CASCADE;
DROP TABLE IF EXISTS public.dm_reactions CASCADE;
DROP TABLE IF EXISTS public.dm_read_status CASCADE;
DROP TABLE IF EXISTS public.direct_messages CASCADE;
DROP TABLE IF EXISTS public.direct_conversation_members CASCADE;
DROP TABLE IF EXISTS public.direct_conversations CASCADE;

-- 1. Channels
CREATE TABLE public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'public',
  space_id TEXT,
  created_by TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Channel members
CREATE TABLE public.chat_channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  is_muted BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, user_id)
);

-- 3. Messages (new schema)
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  thread_id UUID REFERENCES public.chat_messages(id),
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  mentioned_users UUID[],
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Reactions (new schema)
CREATE TABLE public.chat_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- 5. User presence
CREATE TABLE public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  status TEXT DEFAULT 'online',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  custom_status TEXT
);

-- 6. Pinned messages
CREATE TABLE public.chat_pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  pinned_by UUID,
  pinned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel_id, message_id)
);

-- Enable RLS
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_pinned_messages ENABLE ROW LEVEL SECURITY;

-- Channels policies
CREATE POLICY "channels_select" ON public.chat_channels FOR SELECT TO authenticated
  USING (type = 'public' OR EXISTS (
    SELECT 1 FROM public.chat_channel_members WHERE channel_id = chat_channels.id AND user_id = auth.uid()
  ));
CREATE POLICY "channels_insert" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (true);

-- Messages policies
CREATE POLICY "messages_select" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_channels c WHERE c.id = chat_messages.channel_id
    AND (c.type = 'public' OR EXISTS (
      SELECT 1 FROM public.chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid()
    ))
  ));
CREATE POLICY "messages_insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_update" ON public.chat_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "messages_delete" ON public.chat_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Reactions policies
CREATE POLICY "reactions_select" ON public.chat_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reactions_insert" ON public.chat_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reactions_delete" ON public.chat_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Channel members policies
CREATE POLICY "members_select" ON public.chat_channel_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "members_insert" ON public.chat_channel_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "members_update" ON public.chat_channel_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "members_delete" ON public.chat_channel_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Presence policies
CREATE POLICY "presence_select" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence_insert" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence_update" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Pinned messages policies
CREATE POLICY "pinned_select" ON public.chat_pinned_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "pinned_insert" ON public.chat_pinned_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pinned_delete" ON public.chat_pinned_messages FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;

-- Default channels
INSERT INTO public.chat_channels (name, description, type, position) VALUES
  ('général', 'Canal principal de l''équipe Euthymia', 'public', 0),
  ('mbsr', 'Discussions formations MBSR', 'public', 1),
  ('mbct', 'Discussions formations MBCT', 'public', 2),
  ('opale', 'Discussions formations OPALE', 'public', 3),
  ('admin', 'Canal administratif', 'private', 4),
  ('aléatoire', 'Discussions informelles', 'public', 5);
