CREATE OR REPLACE FUNCTION public.shares_org_with_me(_member_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organization_members mine ON mine.org_id = om.org_id
    WHERE om.member_id = _member_id
      AND mine.member_id = public.current_member_id()
  )
$$;

REVOKE ALL ON FUNCTION public.shares_org_with_me(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shares_org_with_me(text) TO authenticated, service_role;

DROP POLICY IF EXISTS team_members_select_scoped ON public.team_members;
CREATE POLICY team_members_select_scoped ON public.team_members
FOR SELECT TO authenticated
USING (public.shares_org_with_me(id));