DROP POLICY IF EXISTS "presence_select" ON public.user_presence;

CREATE POLICY "presence_select" ON public.user_presence
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = public.user_presence.user_id
      AND p.team_member_id IS NOT NULL
      AND public.shares_org_with_me(p.team_member_id)
  )
);