-- Phase 2b : l'équipe consultée (current_org_id) s'applique à tout le monde, super-admin inclus.

-- ===== spaces =====
DROP POLICY IF EXISTS "spaces_select" ON public.spaces;
CREATE POLICY "spaces_select" ON public.spaces FOR SELECT
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "spaces_insert" ON public.spaces;
CREATE POLICY "spaces_insert" ON public.spaces FOR INSERT
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "spaces_update" ON public.spaces;
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id())
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "admin delete spaces" ON public.spaces;
CREATE POLICY "admin delete spaces" ON public.spaces FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_org_member(org_id) AND org_id = public.current_org_id());

-- ===== projects =====
DROP POLICY IF EXISTS "projects_select" ON public.projects;
CREATE POLICY "projects_select" ON public.projects FOR SELECT
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id())
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "admin delete projects" ON public.projects;
CREATE POLICY "admin delete projects" ON public.projects FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_org_member(org_id) AND org_id = public.current_org_id());

-- ===== task_lists =====
DROP POLICY IF EXISTS "task_lists_select" ON public.task_lists;
CREATE POLICY "task_lists_select" ON public.task_lists FOR SELECT
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_lists_insert" ON public.task_lists;
CREATE POLICY "task_lists_insert" ON public.task_lists FOR INSERT
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_lists_update" ON public.task_lists;
CREATE POLICY "task_lists_update" ON public.task_lists FOR UPDATE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id())
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_lists_delete" ON public.task_lists;
CREATE POLICY "task_lists_delete" ON public.task_lists FOR DELETE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());

-- ===== tasks =====
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id())
  WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE
  USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = public.current_org_id());

-- ===== quick_notes : retrait du contournement super-admin =====
DROP POLICY IF EXISTS "quick_notes_select" ON public.quick_notes;
CREATE POLICY "quick_notes_select" ON public.quick_notes FOR SELECT
  USING (auth.uid() = user_id AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "quick_notes_insert" ON public.quick_notes;
CREATE POLICY "quick_notes_insert" ON public.quick_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "quick_notes_update" ON public.quick_notes;
CREATE POLICY "quick_notes_update" ON public.quick_notes FOR UPDATE
  USING (auth.uid() = user_id AND org_id = public.current_org_id())
  WITH CHECK (auth.uid() = user_id AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "quick_notes_delete" ON public.quick_notes;
CREATE POLICY "quick_notes_delete" ON public.quick_notes FOR DELETE
  USING (auth.uid() = user_id AND org_id = public.current_org_id());

-- ===== task_templates =====
DROP POLICY IF EXISTS "task_templates_select" ON public.task_templates;
CREATE POLICY "task_templates_select" ON public.task_templates FOR SELECT
  USING (org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_templates_insert" ON public.task_templates;
CREATE POLICY "task_templates_insert" ON public.task_templates FOR INSERT
  WITH CHECK (org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_templates_update" ON public.task_templates;
CREATE POLICY "task_templates_update" ON public.task_templates FOR UPDATE
  USING ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND org_id = public.current_org_id())
  WITH CHECK ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "task_templates_delete" ON public.task_templates;
CREATE POLICY "task_templates_delete" ON public.task_templates FOR DELETE
  USING ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND org_id = public.current_org_id());

-- ===== custom_statuses =====
DROP POLICY IF EXISTS "custom_statuses_select" ON public.custom_statuses;
CREATE POLICY "custom_statuses_select" ON public.custom_statuses FOR SELECT
  USING (is_team_linked(auth.uid()) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "custom_statuses_insert" ON public.custom_statuses;
CREATE POLICY "custom_statuses_insert" ON public.custom_statuses FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "custom_statuses_update" ON public.custom_statuses;
CREATE POLICY "custom_statuses_update" ON public.custom_statuses FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "custom_statuses_delete" ON public.custom_statuses;
CREATE POLICY "custom_statuses_delete" ON public.custom_statuses FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) AND org_id = public.current_org_id());

-- ===== chat_channels (tolérance org_id NULL conservée) =====
DROP POLICY IF EXISTS "channels_select" ON public.chat_channels;
CREATE POLICY "channels_select" ON public.chat_channels FOR SELECT
  USING (
    (type = 'public' OR created_by = (auth.uid())::text OR is_channel_member(id, auth.uid()))
    AND org_id IS NOT DISTINCT FROM public.current_org_id()
  );
DROP POLICY IF EXISTS "channels_insert" ON public.chat_channels;
CREATE POLICY "channels_insert" ON public.chat_channels FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND org_id IS NOT DISTINCT FROM public.current_org_id());
DROP POLICY IF EXISTS "channels_update" ON public.chat_channels;
CREATE POLICY "channels_update" ON public.chat_channels FOR UPDATE
  USING ((created_by = (auth.uid())::text OR has_role(auth.uid(), 'admin'::app_role)) AND org_id IS NOT DISTINCT FROM public.current_org_id())
  WITH CHECK ((created_by = (auth.uid())::text OR has_role(auth.uid(), 'admin'::app_role)) AND org_id IS NOT DISTINCT FROM public.current_org_id());

-- ===== calendar_events (tolérance org_id NULL conservée) =====
DROP POLICY IF EXISTS "calendar_events_own" ON public.calendar_events;
CREATE POLICY "calendar_events_own" ON public.calendar_events FOR ALL
  USING (auth.uid() = user_id AND org_id IS NOT DISTINCT FROM public.current_org_id())
  WITH CHECK (auth.uid() = user_id AND org_id IS NOT DISTINCT FROM public.current_org_id());