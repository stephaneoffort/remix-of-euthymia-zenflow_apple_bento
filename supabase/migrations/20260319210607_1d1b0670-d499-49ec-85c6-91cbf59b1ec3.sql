
-- Chat categories (admin-managed)
CREATE TABLE public.chat_categories (
  id text NOT NULL DEFAULT ('cc_' || gen_random_uuid()::text) PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '💬',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat categories viewable by everyone" ON public.chat_categories FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert chat categories" ON public.chat_categories FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update chat categories" ON public.chat_categories FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete chat categories" ON public.chat_categories FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Chat messages
CREATE TABLE public.chat_messages (
  id text NOT NULL DEFAULT ('cm_' || gen_random_uuid()::text) PRIMARY KEY,
  category_id text NOT NULL REFERENCES public.chat_categories(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  content text NOT NULL,
  attachment_url text,
  attachment_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat messages viewable by everyone" ON public.chat_messages FOR SELECT TO public USING (true);
CREATE POLICY "Chat messages can be inserted by authenticated" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Chat messages can be deleted by author or admin" ON public.chat_messages FOR DELETE TO authenticated USING (true);

-- Chat reactions
CREATE TABLE public.chat_reactions (
  id text NOT NULL DEFAULT ('cr_' || gen_random_uuid()::text) PRIMARY KEY,
  message_id text NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, member_id, emoji)
);

ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chat reactions viewable by everyone" ON public.chat_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Chat reactions can be inserted by authenticated" ON public.chat_reactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Chat reactions can be deleted by authenticated" ON public.chat_reactions FOR DELETE TO authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;

-- Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);

CREATE POLICY "Chat attachments are publicly accessible" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-attachments');
CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

-- Seed default categories
INSERT INTO public.chat_categories (id, name, icon, sort_order) VALUES
  ('cc_general', 'Général', '💬', 0),
  ('cc_annonces', 'Annonces', '📢', 1),
  ('cc_support', 'Support', '🛟', 2),
  ('cc_random', 'Random', '🎲', 3);
