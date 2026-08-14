-- Restaure les droits d'exécution sur les fonctions SECURITY DEFINER utilisées
-- par les politiques RLS et par le client. Sans ces GRANT, le rôle
-- authenticated obtient des 403 "permission denied for function" sur
-- chaque requête filtrée par RLS, ce qui bloque la connexion.

GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_org_with_me(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.channel_in_my_org(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.task_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.space_in_my_org(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.entity_in_my_org(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_space_manager(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_space(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_object(text) TO authenticated;

-- Fonctions appelées directement par le client
GRANT EXECUTE ON FUNCTION public.get_org_nav_tree() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
