-- Phase 3 : métadonnées de navigation multi-équipes (aucun contenu exposé)
CREATE OR REPLACE FUNCTION public.get_org_nav_tree()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  org_color text,
  org_is_active boolean,
  is_member boolean,
  space_id text,
  space_name text,
  space_icon text,
  space_sort_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.current_member_id() AS member_id, public.is_super_admin() AS super_admin
  ),
  orgs AS (
    -- Équipes dont je suis membre, plus toutes les équipes pour un super-admin
    SELECT o.id, o.name, o.color, o.is_active,
           EXISTS (
             SELECT 1 FROM public.organization_members om
             WHERE om.org_id = o.id AND om.member_id = (SELECT member_id FROM me)
           ) AS is_member
    FROM public.organizations o
    WHERE (SELECT super_admin FROM me)
       OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.org_id = o.id AND om.member_id = (SELECT member_id FROM me)
          )
  )
  SELECT
    orgs.id, orgs.name, orgs.color, orgs.is_active, orgs.is_member,
    s.id, s.name, s.icon, s.sort_order
  FROM orgs
  -- LEFT JOIN : une équipe sans espace apparaît quand même (champs space_* à NULL)
  LEFT JOIN public.spaces s
    ON s.org_id = orgs.id
   AND COALESCE(s.is_archived, false) = false
   AND (
     -- Un super-admin voit tous les espaces ; sinon on respecte la confidentialité
     (SELECT super_admin FROM me)
     OR COALESCE(s.is_private, false) = false
     OR s.owner_member_id = (SELECT member_id FROM me)
     OR EXISTS (SELECT 1 FROM public.space_members sm WHERE sm.space_id = s.id AND sm.member_id = (SELECT member_id FROM me))
     OR EXISTS (SELECT 1 FROM public.space_managers sg WHERE sg.space_id = s.id AND sg.member_id = (SELECT member_id FROM me))
   )
  ORDER BY orgs.name, s.sort_order NULLS LAST, s.name;
$$;

REVOKE ALL ON FUNCTION public.get_org_nav_tree() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_nav_tree() TO authenticated;