-- 1. DÉNORMALISATION org_id -------------------------------------------------
ALTER TABLE public.projects   ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.task_lists ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks      ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_projects_org_id   ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_org_id ON public.task_lists(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_id      ON public.tasks(org_id);

-- Backfill en respectant la chaîne de parenté (ids TEXT)
UPDATE public.projects p SET org_id = s.org_id
  FROM public.spaces s WHERE s.id = p.space_id AND p.org_id IS NULL;

UPDATE public.task_lists l SET org_id = p.org_id
  FROM public.projects p WHERE p.id = l.project_id AND l.org_id IS NULL;

UPDATE public.tasks t SET org_id = l.org_id
  FROM public.task_lists l WHERE l.id = t.list_id AND t.org_id IS NULL;

-- Tâches sans liste : on hérite de la tâche parente
UPDATE public.tasks t SET org_id = pt.org_id
  FROM public.tasks pt WHERE pt.id = t.parent_task_id AND t.org_id IS NULL AND pt.org_id IS NOT NULL;

-- Filet de sécurité : équipe historique (la plus ancienne) pour les orphelins
UPDATE public.projects   SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL;
UPDATE public.task_lists SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL;
UPDATE public.tasks      SET org_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1) WHERE org_id IS NULL;

ALTER TABLE public.projects   ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.task_lists ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks      ALTER COLUMN org_id SET NOT NULL;

-- 2. TRIGGERS D'HÉRITAGE -----------------------------------------------------
-- La parenté fait autorité : la valeur envoyée par le client est toujours écrasée.
CREATE OR REPLACE FUNCTION public.set_project_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.org_id := COALESCE((SELECT s.org_id FROM public.spaces s WHERE s.id = NEW.space_id), NEW.org_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_task_list_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.org_id := COALESCE((SELECT p.org_id FROM public.projects p WHERE p.id = NEW.project_id), NEW.org_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_task_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.org_id := COALESCE(
    (SELECT l.org_id FROM public.task_lists l WHERE l.id = NEW.list_id),
    (SELECT pt.org_id FROM public.tasks pt WHERE pt.id = NEW.parent_task_id),
    NEW.org_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_org_id ON public.projects;
CREATE TRIGGER trg_projects_org_id BEFORE INSERT OR UPDATE OF space_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_org_id();

DROP TRIGGER IF EXISTS trg_task_lists_org_id ON public.task_lists;
CREATE TRIGGER trg_task_lists_org_id BEFORE INSERT OR UPDATE OF project_id ON public.task_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_task_list_org_id();

DROP TRIGGER IF EXISTS trg_tasks_org_id ON public.tasks;
CREATE TRIGGER trg_tasks_org_id BEFORE INSERT OR UPDATE OF list_id, parent_task_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_org_id();

-- 4. HELPERS -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.task_in_my_org(_task_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND public.is_org_member(t.org_id))
$$;

CREATE OR REPLACE FUNCTION public.space_in_my_org(_space_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = _space_id AND public.is_org_member(s.org_id))
$$;

CREATE OR REPLACE FUNCTION public.project_in_my_org(_project_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND public.is_org_member(p.org_id))
$$;

REVOKE EXECUTE ON FUNCTION public.task_in_my_org(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.space_in_my_org(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.project_in_my_org(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.task_in_my_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.space_in_my_org(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_in_my_org(text) TO authenticated, service_role;

-- 3. RLS projects / task_lists / tasks ---------------------------------------
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS "admin delete projects" ON public.projects;
CREATE POLICY "admin delete projects" ON public.projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS task_lists_select ON public.task_lists;
CREATE POLICY task_lists_select ON public.task_lists FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS task_lists_insert ON public.task_lists;
CREATE POLICY task_lists_insert ON public.task_lists FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS task_lists_update ON public.task_lists;
CREATE POLICY task_lists_update ON public.task_lists FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS task_lists_delete ON public.task_lists;
CREATE POLICY task_lists_delete ON public.task_lists FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));

-- 4b. TABLES FILLES RATTACHÉES À UNE TÂCHE -----------------------------------
-- comments
DROP POLICY IF EXISTS comments_select_auth ON public.comments;
CREATE POLICY comments_select_auth ON public.comments FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS comments_insert_auth ON public.comments;
CREATE POLICY comments_insert_auth ON public.comments FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- attachments
DROP POLICY IF EXISTS attachments_select_auth ON public.attachments;
CREATE POLICY attachments_select_auth ON public.attachments FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS attachments_insert_auth ON public.attachments;
CREATE POLICY attachments_insert_auth ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS attachments_delete_auth ON public.attachments;
CREATE POLICY attachments_delete_auth ON public.attachments FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- checklist_items
DROP POLICY IF EXISTS checklist_items_select_auth ON public.checklist_items;
CREATE POLICY checklist_items_select_auth ON public.checklist_items FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS checklist_items_insert_auth ON public.checklist_items;
CREATE POLICY checklist_items_insert_auth ON public.checklist_items FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS checklist_items_update_auth ON public.checklist_items;
CREATE POLICY checklist_items_update_auth ON public.checklist_items FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS checklist_items_delete_auth ON public.checklist_items;
CREATE POLICY checklist_items_delete_auth ON public.checklist_items FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- task_assignees
DROP POLICY IF EXISTS task_assignees_select_auth ON public.task_assignees;
CREATE POLICY task_assignees_select_auth ON public.task_assignees FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_assignees_insert_auth ON public.task_assignees;
CREATE POLICY task_assignees_insert_auth ON public.task_assignees FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_assignees_delete_auth ON public.task_assignees;
CREATE POLICY task_assignees_delete_auth ON public.task_assignees FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- task_dependencies (task_id + depends_on_id doivent appartenir à mon équipe)
DROP POLICY IF EXISTS task_dependencies_select ON public.task_dependencies;
CREATE POLICY task_dependencies_select ON public.task_dependencies FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_dependencies_insert ON public.task_dependencies;
CREATE POLICY task_dependencies_insert ON public.task_dependencies FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id) AND public.task_in_my_org(depends_on_id));
DROP POLICY IF EXISTS task_dependencies_update ON public.task_dependencies;
CREATE POLICY task_dependencies_update ON public.task_dependencies FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id) AND public.task_in_my_org(depends_on_id));
DROP POLICY IF EXISTS task_dependencies_delete ON public.task_dependencies;
CREATE POLICY task_dependencies_delete ON public.task_dependencies FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- task_links
DROP POLICY IF EXISTS task_links_select ON public.task_links;
CREATE POLICY task_links_select ON public.task_links FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_links_insert ON public.task_links;
CREATE POLICY task_links_insert ON public.task_links FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id) AND public.task_in_my_org(linked_task_id));
DROP POLICY IF EXISTS task_links_delete ON public.task_links;
CREATE POLICY task_links_delete ON public.task_links FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- task_reminders
DROP POLICY IF EXISTS task_reminders_select ON public.task_reminders;
CREATE POLICY task_reminders_select ON public.task_reminders FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_reminders_insert ON public.task_reminders;
CREATE POLICY task_reminders_insert ON public.task_reminders FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_reminders_update ON public.task_reminders;
CREATE POLICY task_reminders_update ON public.task_reminders FOR UPDATE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id))
  WITH CHECK (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS task_reminders_delete ON public.task_reminders;
CREATE POLICY task_reminders_delete ON public.task_reminders FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.task_in_my_org(task_id));

-- task_shares
DROP POLICY IF EXISTS "task_shares read own" ON public.task_shares;
CREATE POLICY "task_shares read own" ON public.task_shares FOR SELECT TO authenticated
  USING (((sender_member_id = current_member_id()) OR (target_member_id = current_member_id())) AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS "task_shares insert as sender" ON public.task_shares;
CREATE POLICY "task_shares insert as sender" ON public.task_shares FOR INSERT TO authenticated
  WITH CHECK (sender_member_id = current_member_id() AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS "task_shares delete as sender" ON public.task_shares;
CREATE POLICY "task_shares delete as sender" ON public.task_shares FOR DELETE TO authenticated
  USING (sender_member_id = current_member_id() AND public.task_in_my_org(task_id));

-- figma_links
DROP POLICY IF EXISTS "Users view own figma links" ON public.figma_links;
CREATE POLICY "Users view own figma links" ON public.figma_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS "Users insert own figma links" ON public.figma_links;
CREATE POLICY "Users insert own figma links" ON public.figma_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS "Users update own figma links" ON public.figma_links;
CREATE POLICY "Users update own figma links" ON public.figma_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(task_id));
DROP POLICY IF EXISTS "Users delete own figma links" ON public.figma_links;
CREATE POLICY "Users delete own figma links" ON public.figma_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(task_id));

-- google_docs_links (colonne app_task_id)
DROP POLICY IF EXISTS "Users can view own google docs links" ON public.google_docs_links;
CREATE POLICY "Users can view own google docs links" ON public.google_docs_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can insert own google docs links" ON public.google_docs_links;
CREATE POLICY "Users can insert own google docs links" ON public.google_docs_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can update own google docs links" ON public.google_docs_links;
CREATE POLICY "Users can update own google docs links" ON public.google_docs_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can delete own google docs links" ON public.google_docs_links;
CREATE POLICY "Users can delete own google docs links" ON public.google_docs_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));

-- google_sheets_links (colonne app_task_id)
DROP POLICY IF EXISTS "Users can view their own Sheets links" ON public.google_sheets_links;
CREATE POLICY "Users can view their own Sheets links" ON public.google_sheets_links FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can insert their own Sheets links" ON public.google_sheets_links;
CREATE POLICY "Users can insert their own Sheets links" ON public.google_sheets_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can update their own Sheets links" ON public.google_sheets_links;
CREATE POLICY "Users can update their own Sheets links" ON public.google_sheets_links FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));
DROP POLICY IF EXISTS "Users can delete their own Sheets links" ON public.google_sheets_links;
CREATE POLICY "Users can delete their own Sheets links" ON public.google_sheets_links FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id));

-- google_tasklist_links (colonne app_task_id) — la policy service_role reste inchangée
DROP POLICY IF EXISTS google_tasklist_links_own ON public.google_tasklist_links;
CREATE POLICY google_tasklist_links_own ON public.google_tasklist_links FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.task_in_my_org(app_task_id))
  WITH CHECK (auth.uid() = user_id AND public.task_in_my_org(app_task_id));

-- 5. TABLES D'APPARTENANCE ---------------------------------------------------
DROP POLICY IF EXISTS space_members_select ON public.space_members;
CREATE POLICY space_members_select ON public.space_members FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));
DROP POLICY IF EXISTS space_members_insert ON public.space_members;
CREATE POLICY space_members_insert ON public.space_members FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));
DROP POLICY IF EXISTS space_members_delete ON public.space_members;
CREATE POLICY space_members_delete ON public.space_members FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));

DROP POLICY IF EXISTS space_managers_select ON public.space_managers;
CREATE POLICY space_managers_select ON public.space_managers FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));
DROP POLICY IF EXISTS space_managers_insert ON public.space_managers;
CREATE POLICY space_managers_insert ON public.space_managers FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));
DROP POLICY IF EXISTS space_managers_delete ON public.space_managers;
CREATE POLICY space_managers_delete ON public.space_managers FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.space_in_my_org(space_id));

DROP POLICY IF EXISTS project_members_select ON public.project_members;
CREATE POLICY project_members_select ON public.project_members FOR SELECT TO authenticated
  USING (is_team_linked(auth.uid()) AND public.project_in_my_org(project_id));
DROP POLICY IF EXISTS project_members_insert ON public.project_members;
CREATE POLICY project_members_insert ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (is_team_linked(auth.uid()) AND public.project_in_my_org(project_id));
DROP POLICY IF EXISTS project_members_delete ON public.project_members;
CREATE POLICY project_members_delete ON public.project_members FOR DELETE TO authenticated
  USING (is_team_linked(auth.uid()) AND public.project_in_my_org(project_id));
