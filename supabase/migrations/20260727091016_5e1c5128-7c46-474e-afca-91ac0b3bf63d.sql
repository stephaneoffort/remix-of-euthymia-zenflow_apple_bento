-- 1. app_settings : lecture réservée aux utilisateurs authentifiés
DROP POLICY IF EXISTS "App settings viewable by everyone" ON public.app_settings;
CREATE POLICY "App settings viewable by authenticated"
ON public.app_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.app_settings FROM anon;

-- 2. profiles : lecture limitée à soi-même, ses coéquipiers, ou super-admin
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles viewable by self or teammates"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.is_super_admin()
  OR (team_member_id IS NOT NULL AND public.shares_org_with_me(team_member_id))
);

-- 3. task_templates : restreindre les policies au rôle authenticated (org déjà scopée)
DROP POLICY IF EXISTS "task_templates_select" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_insert" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_update" ON public.task_templates;
DROP POLICY IF EXISTS "task_templates_delete" ON public.task_templates;

CREATE POLICY "task_templates_select" ON public.task_templates
FOR SELECT TO authenticated
USING (public.is_team_linked(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "task_templates_insert" ON public.task_templates
FOR INSERT TO authenticated
WITH CHECK (public.is_team_linked(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "task_templates_update" ON public.task_templates
FOR UPDATE TO authenticated
USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin')) AND org_id = public.current_org_id())
WITH CHECK (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin')) AND org_id = public.current_org_id());

CREATE POLICY "task_templates_delete" ON public.task_templates
FOR DELETE TO authenticated
USING (((created_by = auth.uid()) OR public.has_role(auth.uid(), 'admin')) AND org_id = public.current_org_id());

REVOKE ALL ON public.task_templates FROM anon;

-- 4. storage.objects : lecture scopée par bucket et par appartenance réelle
DROP POLICY IF EXISTS "auth read app buckets" ON storage.objects;
CREATE POLICY "auth read app buckets scoped"
ON storage.objects FOR SELECT TO authenticated
USING (
  -- Pièces jointes de tâches : chemin = "<task_id>/<fichier>"
  (bucket_id = 'task-attachments' AND public.task_in_my_org((storage.foldername(name))[1]))
  -- Avatars et fichiers de discussion : réservés à leur propriétaire
  OR (bucket_id IN ('avatars', 'chat-attachments') AND owner = auth.uid())
);

-- 5. storage.objects : l'update ne doit pas permettre de sortir du bucket d'origine
DROP POLICY IF EXISTS "auth update app buckets own" ON storage.objects;
CREATE POLICY "auth update app buckets own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = ANY (ARRAY['avatars','chat-attachments','task-attachments'])
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = ANY (ARRAY['avatars','chat-attachments','task-attachments'])
  AND owner = auth.uid()
);

-- 6. Suppression des policies "always true" redondantes pour service_role
--    (service_role contourne déjà la RLS : aucune perte de fonctionnalité)
DROP POLICY IF EXISTS "Service role full access canva attachments" ON public.canva_attachments;
DROP POLICY IF EXISTS "Service role full access canva connections" ON public.canva_connections;
DROP POLICY IF EXISTS "Service role full access dropbox attachments" ON public.dropbox_attachments;
DROP POLICY IF EXISTS "Service role full access dropbox connections" ON public.dropbox_connections;
DROP POLICY IF EXISTS "Service role full access gmail connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "google_tasklist_links_service" ON public.google_tasklist_links;
DROP POLICY IF EXISTS "google_tasks_connections_service" ON public.google_tasks_connections;
DROP POLICY IF EXISTS "Service role full access miro attachments" ON public.miro_attachments;
DROP POLICY IF EXISTS "Service role full access miro connections" ON public.miro_connections;
DROP POLICY IF EXISTS "n8n_connections_service" ON public.n8n_connections;
DROP POLICY IF EXISTS "notion_attachments_service" ON public.notion_attachments;
DROP POLICY IF EXISTS "notion_connections_service" ON public.notion_connections;
DROP POLICY IF EXISTS "Service role full access zoom connections" ON public.zoom_connections;
DROP POLICY IF EXISTS "Service role full access zoom meetings" ON public.zoom_meetings;

-- 7. Fonctions SECURITY DEFINER : retirer EXECUTE là où ce n'est pas nécessaire
--    a) Fonctions de déclencheurs / administration : aucun appel client légitime
REVOKE EXECUTE ON FUNCTION public.set_project_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_task_list_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_task_org_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_recurring_task() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_task_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_task_share_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_task_dependencies_done() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_support_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_by_email(text) FROM PUBLIC, anon, authenticated;

--    b) Helpers utilisés dans les policies RLS : conserver authenticated, retirer anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.can_access_space(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_member_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_space_manager(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_linked(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_org_with_me(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.task_in_my_org(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.project_in_my_org(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.space_in_my_org(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_org_nav_tree() FROM PUBLIC, anon;