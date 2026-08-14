-- Core org/team isolation predicates used in RLS policies
GRANT EXECUTE ON FUNCTION public.shares_org_with_me(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_linked(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Chat predicates
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.channel_in_my_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_object(text) TO authenticated;

-- Space/project/task predicates
GRANT EXECUTE ON FUNCTION public.can_access_space(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_manager(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.entity_in_my_org(text, text) TO authenticated;

-- Client-callable helpers (kept executable intentionally; bounded by RLS/ownership)
GRANT EXECUTE ON FUNCTION public.get_org_nav_tree() TO authenticated;