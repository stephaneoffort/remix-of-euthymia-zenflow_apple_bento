DROP POLICY IF EXISTS "team_members_select_scoped" ON public.team_members;
CREATE POLICY "team_members_select_scoped"
ON public.team_members
FOR SELECT
TO authenticated
USING (public.shares_org_with_me(id) OR id = public.current_member_id());