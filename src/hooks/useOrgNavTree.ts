import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

/** Espace tel qu'exposé par la navigation (métadonnées uniquement) */
export interface NavSpace {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number | null;
}

/** Équipe accessible avec ses espaces (aucune donnée de contenu) */
export interface NavOrg {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
  /** L'utilisateur est réellement membre (par opposition à un accès super-admin) */
  isMember: boolean;
  spaces: NavSpace[];
}

/**
 * Arborescence de navigation multi-équipes.
 * S'appuie sur get_org_nav_tree() : identifiants, noms, couleurs et icônes,
 * rien d'autre. Le contenu reste cloisonné par la RLS sur l'équipe active.
 */
export function useOrgNavTree() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<NavOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_org_nav_tree');
      if (error || !data) {
        setOrgs([]);
        return;
      }
      const byOrg = new Map<string, NavOrg>();
      for (const row of data) {
        let org = byOrg.get(row.org_id);
        if (!org) {
          org = {
            id: row.org_id,
            name: row.org_name,
            color: row.org_color,
            isActive: row.org_is_active,
            isMember: row.is_member,
            spaces: [],
          };
          byOrg.set(row.org_id, org);
        }
        // Une équipe sans espace remonte une ligne avec space_id à NULL
        if (row.space_id) {
          org.spaces.push({
            id: row.space_id,
            name: row.space_name ?? '',
            icon: row.space_icon ?? null,
            sortOrder: row.space_sort_order ?? null,
          });
        }
      }
      setOrgs(Array.from(byOrg.values()));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { navOrgs: orgs, navLoading: loading, refreshNavTree: load };
}
