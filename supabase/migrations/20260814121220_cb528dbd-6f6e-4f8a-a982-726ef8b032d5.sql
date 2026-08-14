-- ============ TABLE 1 : time_lots ============
CREATE TABLE public.time_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT '',
  target_hours numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_lots_org_code_unique UNIQUE (org_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_lots TO authenticated;
GRANT ALL ON public.time_lots TO service_role;

ALTER TABLE public.time_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_lots_select" ON public.time_lots
FOR SELECT
USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id());

CREATE POLICY "time_lots_insert" ON public.time_lots
FOR INSERT
WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND is_org_admin(org_id));

CREATE POLICY "time_lots_update" ON public.time_lots
FOR UPDATE
USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND is_org_admin(org_id))
WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND is_org_admin(org_id));

CREATE POLICY "time_lots_delete" ON public.time_lots
FOR DELETE
USING (is_org_admin(org_id) AND org_id = current_org_id());

CREATE TRIGGER update_time_lots_updated_at
BEFORE UPDATE ON public.time_lots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TABLE 2 : time_entries ============
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.time_lots(id) ON DELETE SET NULL,
  member_id text NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  seconds integer NOT NULL CHECK (seconds > 0),
  started_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;

CREATE INDEX time_entries_org_started_idx ON public.time_entries (org_id, started_at DESC);
CREATE INDEX time_entries_lot_idx ON public.time_entries (lot_id);
CREATE INDEX time_entries_member_idx ON public.time_entries (member_id);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON public.time_entries
FOR SELECT
USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id());

CREATE POLICY "time_entries_insert" ON public.time_entries
FOR INSERT
WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND member_id = current_member_id());

CREATE POLICY "time_entries_update" ON public.time_entries
FOR UPDATE
USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND (member_id = current_member_id() OR is_org_admin(org_id)))
WITH CHECK (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND (member_id = current_member_id() OR is_org_admin(org_id)));

CREATE POLICY "time_entries_delete" ON public.time_entries
FOR DELETE
USING (is_team_linked(auth.uid()) AND is_org_member(org_id) AND org_id = current_org_id() AND (member_id = current_member_id() OR is_org_admin(org_id)));

CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TABLE 3 : time_active ============
CREATE TABLE public.time_active (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id text NOT NULL UNIQUE REFERENCES public.team_members(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.time_lots(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  accumulated_seconds integer NOT NULL DEFAULT 0,
  is_paused boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_active TO authenticated;
GRANT ALL ON public.time_active TO service_role;

ALTER TABLE public.time_active ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_active_select" ON public.time_active
FOR SELECT TO authenticated
USING (member_id = current_member_id());

CREATE POLICY "time_active_insert" ON public.time_active
FOR INSERT TO authenticated
WITH CHECK (member_id = current_member_id() AND is_org_member(org_id));

CREATE POLICY "time_active_update" ON public.time_active
FOR UPDATE TO authenticated
USING (member_id = current_member_id())
WITH CHECK (member_id = current_member_id() AND is_org_member(org_id));

CREATE POLICY "time_active_delete" ON public.time_active
FOR DELETE TO authenticated
USING (member_id = current_member_id());

-- ============ TRIGGERS DE COHÉRENCE ORG ============
CREATE OR REPLACE FUNCTION public.set_time_entry_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT p.org_id INTO NEW.org_id FROM public.projects p WHERE p.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_time_entry_org_id() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_time_entries_org_id
BEFORE INSERT OR UPDATE OF project_id ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.set_time_entry_org_id();

CREATE TRIGGER set_time_active_org_id
BEFORE INSERT OR UPDATE OF project_id ON public.time_active
FOR EACH ROW EXECUTE FUNCTION public.set_time_entry_org_id();

-- ============ DONNÉES INITIALES ============
INSERT INTO public.time_lots (org_id, code, label, category, target_hours, sort_order)
SELECT o.id, l.code, l.label, l.category, l.target_hours, l.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('L0','Diagnostic d''état et cadrage','Chantier SEO/GEO',2::numeric,10),
  ('L1','Audit technique complet','Chantier SEO/GEO',5,20),
  ('L2','Structure de titres H1-H3','Chantier SEO/GEO',6,30),
  ('L3','Métadonnées','Chantier SEO/GEO',5,40),
  ('L4','Réécriture SEO/GEO','Chantier SEO/GEO',12,50),
  ('L5','FAQ et balisage JSON-LD','Chantier SEO/GEO',8,60),
  ('L6','Redirections 301 et 404','Chantier SEO/GEO',6,70),
  ('L7','Traitement des images','Chantier SEO/GEO',6,80),
  ('L8','Balisage schema.org','Chantier SEO/GEO',4,90),
  ('L9','Protocole de mesure GEO','Chantier SEO/GEO',3,100),
  ('L10','Contrôle qualité et livraison','Chantier SEO/GEO',5,110),
  ('V1','Relevé et mesure','Hors production',0.5,200),
  ('V2','Avant-vente et devis','Hors production',2,210),
  ('V3','Administratif','Hors production',1,220)
) AS l(code, label, category, target_hours, sort_order)
ON CONFLICT (org_id, code) DO NOTHING;