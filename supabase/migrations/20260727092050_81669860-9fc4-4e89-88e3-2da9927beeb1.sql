DROP POLICY IF EXISTS "comments_insert_auth" ON public.comments;
CREATE POLICY "comments_insert_auth" ON public.comments
FOR INSERT TO authenticated
WITH CHECK (
  public.is_team_linked(auth.uid())
  AND public.task_in_my_org(task_id)
  AND author_id = public.current_member_id()
);

DROP POLICY IF EXISTS "channels_insert" ON public.chat_channels;
CREATE POLICY "channels_insert" ON public.chat_channels
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND NOT (org_id IS DISTINCT FROM public.current_org_id())
  AND created_by = auth.uid()::text
);

DROP POLICY IF EXISTS "task_templates_insert" ON public.task_templates;
CREATE POLICY "task_templates_insert" ON public.task_templates
FOR INSERT TO authenticated
WITH CHECK (
  public.is_team_linked(auth.uid())
  AND org_id = public.current_org_id()
  AND (created_by IS NULL OR created_by = auth.uid())
);