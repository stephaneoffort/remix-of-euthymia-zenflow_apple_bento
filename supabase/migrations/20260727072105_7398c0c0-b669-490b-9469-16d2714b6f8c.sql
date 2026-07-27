-- 1. Tables multi-équipes -----------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  color text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, member_id)
);
CREATE INDEX idx_organization_members_member ON public.organization_members(member_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.member_active_org (
  member_id text PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_active_org TO authenticated;
GRANT ALL ON public.member_active_org TO service_role;
ALTER TABLE public.member_active_org ENABLE ROW LEVEL SECURITY;

-- 2. Colonnes org_id -----------------------------------------------------
ALTER TABLE public.spaces ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.chat_channels ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quick_notes ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.task_templates ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.custom_statuses ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.filter_presets ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.calendar_events ADD COLUMN org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_spaces_org ON public.spaces(org_id);
CREATE INDEX idx_chat_channels_org ON public.chat_channels(org_id);
CREATE INDEX idx_quick_notes_org ON public.quick_notes(org_id);
CREATE INDEX idx_task_templates_org ON public.task_templates(org_id);
CREATE INDEX idx_custom_statuses_org ON public.custom_statuses(org_id);
CREATE INDEX idx_filter_presets_org ON public.filter_presets(org_id);
CREATE INDEX idx_calendar_events_org ON public.calendar_events(org_id);

-- 3. Fonctions -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND member_id = public.current_member_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = _org_id AND member_id = public.current_member_id()
      AND role IN ('owner','admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.member_active_org WHERE member_id = public.current_member_id()
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, service_role;

-- 4. Backfill ------------------------------------------------------------
INSERT INTO public.organizations (name, slug) VALUES
  ('Euthymia', 'euthymia'),
  ('Institut Cèdre', 'institut-cedre')
ON CONFLICT (slug) DO NOTHING;

UPDATE public.spaces          SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.chat_channels   SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.quick_notes     SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.task_templates  SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.custom_statuses SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.filter_presets  SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;
UPDATE public.calendar_events SET org_id = (SELECT id FROM public.organizations WHERE slug='euthymia') WHERE org_id IS NULL;

-- Tous les membres existants rejoignent Euthymia
INSERT INTO public.organization_members (org_id, member_id, role)
SELECT (SELECT id FROM public.organizations WHERE slug='euthymia'), tm.id, 'member'
FROM public.team_members tm
ON CONFLICT DO NOTHING;

-- Les administrateurs généraux deviennent propriétaires des deux équipes
INSERT INTO public.organization_members (org_id, member_id, role)
SELECT o.id, p.team_member_id, 'owner'
FROM public.organizations o
CROSS JOIN public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
WHERE p.team_member_id IS NOT NULL
ON CONFLICT (org_id, member_id) DO UPDATE SET role = 'owner';

-- Équipe active par défaut : Euthymia
INSERT INTO public.member_active_org (member_id, org_id)
SELECT tm.id, (SELECT id FROM public.organizations WHERE slug='euthymia')
FROM public.team_members tm
ON CONFLICT (member_id) DO NOTHING;

ALTER TABLE public.spaces          ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.quick_notes     ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.task_templates  ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.custom_statuses ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.filter_presets  ALTER COLUMN org_id SET NOT NULL;

-- 5. RLS des nouvelles tables -------------------------------------------
CREATE POLICY "organizations_select" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "organizations_insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "organizations_update" ON public.organizations FOR UPDATE TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY "organizations_delete" ON public.organizations FOR DELETE TO authenticated USING (public.is_super_admin());

CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(org_id));
CREATE POLICY "org_members_insert" ON public.organization_members FOR INSERT TO authenticated WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "org_members_update" ON public.organization_members FOR UPDATE TO authenticated USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "org_members_delete" ON public.organization_members FOR DELETE TO authenticated USING (public.is_org_admin(org_id));

CREATE POLICY "active_org_select" ON public.member_active_org FOR SELECT TO authenticated USING (member_id = public.current_member_id());
CREATE POLICY "active_org_insert" ON public.member_active_org FOR INSERT TO authenticated WITH CHECK (member_id = public.current_member_id() AND public.is_org_member(org_id));
CREATE POLICY "active_org_update" ON public.member_active_org FOR UPDATE TO authenticated USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id() AND public.is_org_member(org_id));
CREATE POLICY "active_org_delete" ON public.member_active_org FOR DELETE TO authenticated USING (member_id = public.current_member_id());

-- 6. Cloisonnement des policies existantes -------------------------------
DROP POLICY IF EXISTS "spaces_select" ON public.spaces;
DROP POLICY IF EXISTS "spaces_insert" ON public.spaces;
DROP POLICY IF EXISTS "spaces_update" ON public.spaces;
DROP POLICY IF EXISTS "admin delete spaces" ON public.spaces;
CREATE POLICY "spaces_select" ON public.spaces FOR SELECT TO authenticated USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
CREATE POLICY "spaces_insert" ON public.spaces FOR INSERT TO authenticated WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
CREATE POLICY "spaces_update" ON public.spaces FOR UPDATE TO authenticated USING (is_team_linked(auth.uid()) AND public.is_org_member(org_id)) WITH CHECK (is_team_linked(auth.uid()) AND public.is_org_member(org_id));
CREATE POLICY "admin delete spaces" ON public.spaces FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND public.is_org_member(org_id));

DROP POLICY IF EXISTS "Users can view their own quick notes" ON public.quick_notes;
DROP POLICY IF EXISTS "Users can insert their own quick notes" ON public.quick_notes;
DROP POLICY IF EXISTS "Users can update their own quick notes" ON public.quick_notes;
DROP POLICY IF EXISTS "Users can delete their own quick notes" ON public.quick_notes;
CREATE POLICY "quick_notes_select" ON public.quick_notes FOR SELECT TO authenticated USING (auth.uid() = user_id AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "quick_notes_insert" ON public.quick_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "quick_notes_update" ON public.quick_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id AND (org_id = public.current_org_id() OR public.is_super_admin())) WITH CHECK (auth.uid() = user_id AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "quick_notes_delete" ON public.quick_notes FOR DELETE TO authenticated USING (auth.uid() = user_id AND (org_id = public.current_org_id() OR public.is_super_admin()));

DROP POLICY IF EXISTS "Templates viewable by authenticated" ON public.task_templates;
DROP POLICY IF EXISTS "Templates insertable by authenticated" ON public.task_templates;
DROP POLICY IF EXISTS "Templates updatable by creator or admin" ON public.task_templates;
DROP POLICY IF EXISTS "Templates deletable by creator or admin" ON public.task_templates;
CREATE POLICY "task_templates_select" ON public.task_templates FOR SELECT TO authenticated USING (org_id = public.current_org_id() OR public.is_super_admin());
CREATE POLICY "task_templates_insert" ON public.task_templates FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id() OR public.is_super_admin());
CREATE POLICY "task_templates_update" ON public.task_templates FOR UPDATE TO authenticated USING ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND (org_id = public.current_org_id() OR public.is_super_admin())) WITH CHECK ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "task_templates_delete" ON public.task_templates FOR DELETE TO authenticated USING ((created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) AND (org_id = public.current_org_id() OR public.is_super_admin()));

DROP POLICY IF EXISTS "custom_statuses_select" ON public.custom_statuses;
DROP POLICY IF EXISTS "Admins can insert custom statuses" ON public.custom_statuses;
DROP POLICY IF EXISTS "Admins can update custom statuses" ON public.custom_statuses;
DROP POLICY IF EXISTS "Admins can delete custom statuses" ON public.custom_statuses;
CREATE POLICY "custom_statuses_select" ON public.custom_statuses FOR SELECT TO authenticated USING (is_team_linked(auth.uid()) AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "custom_statuses_insert" ON public.custom_statuses FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "custom_statuses_update" ON public.custom_statuses FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "custom_statuses_delete" ON public.custom_statuses FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) AND (org_id = public.current_org_id() OR public.is_super_admin()));

DROP POLICY IF EXISTS "own filter_presets read" ON public.filter_presets;
DROP POLICY IF EXISTS "own filter_presets insert" ON public.filter_presets;
DROP POLICY IF EXISTS "own filter_presets update" ON public.filter_presets;
DROP POLICY IF EXISTS "own filter_presets delete" ON public.filter_presets;
CREATE POLICY "own filter_presets read" ON public.filter_presets FOR SELECT TO authenticated USING (member_id = current_member_id() AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "own filter_presets insert" ON public.filter_presets FOR INSERT TO authenticated WITH CHECK (member_id = current_member_id() AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "own filter_presets update" ON public.filter_presets FOR UPDATE TO authenticated USING (member_id = current_member_id() AND (org_id = public.current_org_id() OR public.is_super_admin())) WITH CHECK (member_id = current_member_id() AND (org_id = public.current_org_id() OR public.is_super_admin()));
CREATE POLICY "own filter_presets delete" ON public.filter_presets FOR DELETE TO authenticated USING (member_id = current_member_id() AND (org_id = public.current_org_id() OR public.is_super_admin()));

DROP POLICY IF EXISTS "channels_select" ON public.chat_channels;
DROP POLICY IF EXISTS "channels_insert" ON public.chat_channels;
DROP POLICY IF EXISTS "channels_update" ON public.chat_channels;
CREATE POLICY "channels_select" ON public.chat_channels FOR SELECT TO authenticated USING (
  ((type = 'public') OR (created_by = (auth.uid())::text) OR is_channel_member(id, auth.uid()))
  AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin())
);
CREATE POLICY "channels_insert" ON public.chat_channels FOR INSERT TO authenticated WITH CHECK (
  auth.uid() IS NOT NULL AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin())
);
CREATE POLICY "channels_update" ON public.chat_channels FOR UPDATE TO authenticated USING (
  ((created_by = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role))
  AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin())
) WITH CHECK (
  ((created_by = (auth.uid())::text) OR has_role(auth.uid(), 'admin'::app_role))
  AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin())
);

DROP POLICY IF EXISTS "calendar_events_own" ON public.calendar_events;
CREATE POLICY "calendar_events_own" ON public.calendar_events FOR ALL TO authenticated
USING (auth.uid() = user_id AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin()))
WITH CHECK (auth.uid() = user_id AND (org_id IS NOT DISTINCT FROM public.current_org_id() OR public.is_super_admin()));