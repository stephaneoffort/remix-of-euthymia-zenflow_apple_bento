
-- 1. Revoke EXECUTE on SECURITY DEFINER helpers/triggers
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_recurring_task() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_task_dependencies_done() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_space_manager(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_space(text, text) FROM PUBLIC, anon;

-- 2. Helper: current user's linked team_member_id
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_member_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;

-- 3. Drop existing permissive policies on core tables
DO $$
DECLARE t text; p record;
BEGIN
  FOR t IN SELECT unnest(ARRAY['tasks','projects','spaces','task_lists','team_members',
                                'space_members','space_managers','filter_presets']) LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END $$;

-- tasks
CREATE POLICY "auth read tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- projects
CREATE POLICY "auth read projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- spaces
CREATE POLICY "auth read spaces" ON public.spaces FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert spaces" ON public.spaces FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update spaces" ON public.spaces FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete spaces" ON public.spaces FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- task_lists
CREATE POLICY "auth read lists" ON public.task_lists FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert lists" ON public.task_lists FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update lists" ON public.task_lists FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete lists" ON public.task_lists FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- team_members
CREATE POLICY "auth read team_members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert team_members" ON public.team_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update team_members" ON public.team_members FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin delete team_members" ON public.team_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- space_members / space_managers
CREATE POLICY "auth read space_members" ON public.space_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth ins space_members" ON public.space_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth del space_members" ON public.space_members FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth read space_managers" ON public.space_managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth ins space_managers" ON public.space_managers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth del space_managers" ON public.space_managers FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- filter_presets: scope to owner
CREATE POLICY "own filter_presets read" ON public.filter_presets FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());
CREATE POLICY "own filter_presets insert" ON public.filter_presets FOR INSERT TO authenticated
  WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "own filter_presets update" ON public.filter_presets FOR UPDATE TO authenticated
  USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "own filter_presets delete" ON public.filter_presets FOR DELETE TO authenticated
  USING (member_id = public.current_member_id());

-- 4. push_subscriptions scoped to owner
DROP POLICY IF EXISTS "Push subs viewable by everyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subs insertable by everyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subs updatable by everyone" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Push subs deletable by everyone" ON public.push_subscriptions;

CREATE POLICY "own push_subs read" ON public.push_subscriptions FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());
CREATE POLICY "own push_subs insert" ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "own push_subs update" ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());
CREATE POLICY "own push_subs delete" ON public.push_subscriptions FOR DELETE TO authenticated
  USING (member_id = public.current_member_id());

-- 5. task_shares
DROP POLICY IF EXISTS "Task shares viewable by everyone" ON public.task_shares;
DROP POLICY IF EXISTS "Task shares insertable by everyone" ON public.task_shares;
DROP POLICY IF EXISTS "Task shares deletable by everyone" ON public.task_shares;

CREATE POLICY "task_shares read own" ON public.task_shares FOR SELECT TO authenticated
  USING (sender_member_id = public.current_member_id()
         OR target_member_id = public.current_member_id());
CREATE POLICY "task_shares insert as sender" ON public.task_shares FOR INSERT TO authenticated
  WITH CHECK (sender_member_id = public.current_member_id());
CREATE POLICY "task_shares delete as sender" ON public.task_shares FOR DELETE TO authenticated
  USING (sender_member_id = public.current_member_id());

-- 6. chat_channels: restricted update
DROP POLICY IF EXISTS "channels_update" ON public.chat_channels;
CREATE POLICY "channels_update" ON public.chat_channels FOR UPDATE TO authenticated
  USING (created_by = (auth.uid())::text OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (created_by = (auth.uid())::text OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "channels_insert" ON public.chat_channels;
CREATE POLICY "channels_insert" ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 7. Storage objects: ownership + auth-only reads on app buckets
DROP POLICY IF EXISTS "Anyone can delete task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Chat attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;

CREATE POLICY "auth read app buckets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('avatars','chat-attachments','task-attachments'));
CREATE POLICY "auth insert app buckets own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars','chat-attachments','task-attachments') AND owner = auth.uid());
CREATE POLICY "auth update app buckets own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars','chat-attachments','task-attachments') AND owner = auth.uid())
  WITH CHECK (owner = auth.uid());
CREATE POLICY "auth delete app buckets own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars','chat-attachments','task-attachments') AND owner = auth.uid());
