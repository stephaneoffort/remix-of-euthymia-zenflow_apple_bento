
-- Helper: channel membership (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_channel_member(_channel_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channel_members
    WHERE channel_id = _channel_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated, service_role;

-- Helper: is caller a linked team member (used to gate broad SELECT)
CREATE OR REPLACE FUNCTION public.is_team_linked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND team_member_id IS NOT NULL
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_team_linked(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_linked(uuid) TO authenticated, service_role;

-- =========================================================
-- chat_channel_members: scope SELECT to co-members
-- =========================================================
DROP POLICY IF EXISTS members_select ON public.chat_channel_members;
CREATE POLICY members_select ON public.chat_channel_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_channel_member(channel_id, auth.uid()));

-- =========================================================
-- chat_reactions: scope SELECT via channel membership
-- =========================================================
DROP POLICY IF EXISTS reactions_select ON public.chat_reactions;
DROP POLICY IF EXISTS "reactions viewable by everyone" ON public.chat_reactions;
DROP POLICY IF EXISTS "Reactions viewable by authenticated" ON public.chat_reactions;
CREATE POLICY reactions_select ON public.chat_reactions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_messages m
    WHERE m.id = chat_reactions.message_id
      AND public.is_channel_member(m.channel_id, auth.uid())
  ));

-- =========================================================
-- chat_pinned_messages: scope by channel membership
-- =========================================================
DROP POLICY IF EXISTS pinned_select ON public.chat_pinned_messages;
DROP POLICY IF EXISTS pinned_insert ON public.chat_pinned_messages;
DROP POLICY IF EXISTS pinned_delete ON public.chat_pinned_messages;
CREATE POLICY pinned_select ON public.chat_pinned_messages
  FOR SELECT TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY pinned_insert ON public.chat_pinned_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_channel_member(channel_id, auth.uid()));
CREATE POLICY pinned_delete ON public.chat_pinned_messages
  FOR DELETE TO authenticated
  USING (public.is_channel_member(channel_id, auth.uid()));

-- =========================================================
-- comment_reads: scope to caller's own member id
-- =========================================================
DROP POLICY IF EXISTS comment_reads_select ON public.comment_reads;
DROP POLICY IF EXISTS comment_reads_insert ON public.comment_reads;
DROP POLICY IF EXISTS comment_reads_delete ON public.comment_reads;
CREATE POLICY comment_reads_select ON public.comment_reads
  FOR SELECT TO authenticated USING (member_id = public.current_member_id());
CREATE POLICY comment_reads_insert ON public.comment_reads
  FOR INSERT TO authenticated WITH CHECK (member_id = public.current_member_id());
CREATE POLICY comment_reads_delete ON public.comment_reads
  FOR DELETE TO authenticated USING (member_id = public.current_member_id());

-- =========================================================
-- task_related_tables_public_access: switch {public} role to {authenticated}
-- =========================================================
-- attachments
DROP POLICY IF EXISTS "Attachments are viewable by everyone" ON public.attachments;
DROP POLICY IF EXISTS "Attachments can be deleted by everyone" ON public.attachments;
DROP POLICY IF EXISTS "Attachments can be inserted by everyone" ON public.attachments;
CREATE POLICY "attachments_select_auth" ON public.attachments FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "attachments_insert_auth" ON public.attachments FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "attachments_delete_auth" ON public.attachments FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- comments
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Comments can be inserted by everyone" ON public.comments;
CREATE POLICY "comments_select_auth" ON public.comments FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "comments_insert_auth" ON public.comments FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));

-- checklist_items
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='checklist_items' LOOP
    EXECUTE format('DROP POLICY %I ON public.checklist_items', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "checklist_items_select_auth" ON public.checklist_items FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "checklist_items_insert_auth" ON public.checklist_items FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "checklist_items_update_auth" ON public.checklist_items FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "checklist_items_delete_auth" ON public.checklist_items FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- task_assignees
DROP POLICY IF EXISTS "Task assignees are viewable by everyone" ON public.task_assignees;
DROP POLICY IF EXISTS "Task assignees can be deleted by everyone" ON public.task_assignees;
DROP POLICY IF EXISTS "Task assignees can be inserted by everyone" ON public.task_assignees;
CREATE POLICY "task_assignees_select_auth" ON public.task_assignees FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "task_assignees_insert_auth" ON public.task_assignees FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "task_assignees_delete_auth" ON public.task_assignees FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- task_dependencies
DROP POLICY IF EXISTS task_dependencies_select ON public.task_dependencies;
DROP POLICY IF EXISTS task_dependencies_insert ON public.task_dependencies;
DROP POLICY IF EXISTS task_dependencies_update ON public.task_dependencies;
DROP POLICY IF EXISTS task_dependencies_delete ON public.task_dependencies;
CREATE POLICY task_dependencies_select ON public.task_dependencies FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY task_dependencies_insert ON public.task_dependencies FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY task_dependencies_update ON public.task_dependencies FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY task_dependencies_delete ON public.task_dependencies FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- task_links
DROP POLICY IF EXISTS task_links_select ON public.task_links;
DROP POLICY IF EXISTS task_links_insert ON public.task_links;
DROP POLICY IF EXISTS task_links_delete ON public.task_links;
CREATE POLICY task_links_select ON public.task_links FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY task_links_insert ON public.task_links FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY task_links_delete ON public.task_links FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- task_reminders
DROP POLICY IF EXISTS "Task reminders viewable by everyone" ON public.task_reminders;
DROP POLICY IF EXISTS "Task reminders insertable by everyone" ON public.task_reminders;
DROP POLICY IF EXISTS "Task reminders updatable by everyone" ON public.task_reminders;
DROP POLICY IF EXISTS "Task reminders deletable by everyone" ON public.task_reminders;
CREATE POLICY task_reminders_select ON public.task_reminders FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY task_reminders_insert ON public.task_reminders FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY task_reminders_update ON public.task_reminders FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY task_reminders_delete ON public.task_reminders FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- project_members
DROP POLICY IF EXISTS "Project members viewable by everyone" ON public.project_members;
DROP POLICY IF EXISTS "Project members insertable by everyone" ON public.project_members;
DROP POLICY IF EXISTS "Project members deletable by everyone" ON public.project_members;
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY project_members_insert ON public.project_members FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY project_members_delete ON public.project_members FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- custom_statuses SELECT (was public role)
DROP POLICY IF EXISTS "Custom statuses viewable by everyone" ON public.custom_statuses;
CREATE POLICY custom_statuses_select ON public.custom_statuses FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));

-- =========================================================
-- tasks_projects_lists_broad_authenticated_access: require team-linked caller
-- =========================================================
-- tasks
DROP POLICY IF EXISTS "auth read tasks" ON public.tasks;
DROP POLICY IF EXISTS "auth insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "auth update tasks" ON public.tasks;
DROP POLICY IF EXISTS "auth delete tasks" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- projects
DROP POLICY IF EXISTS "auth read projects" ON public.projects;
DROP POLICY IF EXISTS "auth insert projects" ON public.projects;
DROP POLICY IF EXISTS "auth update projects" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));

-- task_lists
DROP POLICY IF EXISTS "auth read lists" ON public.task_lists;
DROP POLICY IF EXISTS "auth insert lists" ON public.task_lists;
DROP POLICY IF EXISTS "auth update lists" ON public.task_lists;
DROP POLICY IF EXISTS "auth delete lists" ON public.task_lists;
CREATE POLICY "task_lists_select" ON public.task_lists FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "task_lists_insert" ON public.task_lists FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "task_lists_update" ON public.task_lists FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "task_lists_delete" ON public.task_lists FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- spaces / space_members / space_managers
DROP POLICY IF EXISTS "auth read spaces" ON public.spaces;
DROP POLICY IF EXISTS "auth insert spaces" ON public.spaces;
DROP POLICY IF EXISTS "auth update spaces" ON public.spaces;
CREATE POLICY "spaces_select" ON public.spaces FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "spaces_insert" ON public.spaces FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE TO authenticated USING (public.is_team_linked(auth.uid())) WITH CHECK (public.is_team_linked(auth.uid()));

DROP POLICY IF EXISTS "auth read space_members" ON public.space_members;
DROP POLICY IF EXISTS "auth ins space_members" ON public.space_members;
DROP POLICY IF EXISTS "auth del space_members" ON public.space_members;
CREATE POLICY "space_members_select" ON public.space_members FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "space_members_insert" ON public.space_members FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "space_members_delete" ON public.space_members FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

DROP POLICY IF EXISTS "auth read space_managers" ON public.space_managers;
DROP POLICY IF EXISTS "auth ins space_managers" ON public.space_managers;
DROP POLICY IF EXISTS "auth del space_managers" ON public.space_managers;
CREATE POLICY "space_managers_select" ON public.space_managers FOR SELECT TO authenticated USING (public.is_team_linked(auth.uid()));
CREATE POLICY "space_managers_insert" ON public.space_managers FOR INSERT TO authenticated WITH CHECK (public.is_team_linked(auth.uid()));
CREATE POLICY "space_managers_delete" ON public.space_managers FOR DELETE TO authenticated USING (public.is_team_linked(auth.uid()));

-- =========================================================
-- team_members: restrict visibility to linked team members / admin
-- =========================================================
DROP POLICY IF EXISTS "auth read team_members" ON public.team_members;
DROP POLICY IF EXISTS "auth insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "auth update team_members" ON public.team_members;
CREATE POLICY "team_members_select_scoped" ON public.team_members
  FOR SELECT TO authenticated
  USING (public.is_team_linked(auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "team_members_insert_admin" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "team_members_update_admin_or_self" ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR id = public.current_member_id())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR id = public.current_member_id());

-- =========================================================
-- user_roles: restrict SELECT to self or admin
-- =========================================================
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SECURITY DEFINER functions: revoke EXECUTE from PUBLIC/anon
-- =========================================================
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_by_email(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_space_manager(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_space_manager(text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_access_space(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_space(text, text) TO authenticated, service_role;

-- Trigger/handler functions do not need to be exposed as RPC.
REVOKE EXECUTE ON FUNCTION public.log_task_share_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_recurring_task() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_task_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_task_dependencies_done() FROM PUBLIC, anon, authenticated;
