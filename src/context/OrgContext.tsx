import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  logo_url: string | null;
  is_active?: boolean;
}

export type OrgRole = 'owner' | 'admin' | 'member';

interface OrgContextType {
  currentOrg: Organization | null;
  /** Équipes accessibles : celles du membre, ou toutes pour un super-admin */
  myOrgs: Organization[];
  /** Ids des équipes dont l'utilisateur est réellement membre (utile pour le super-admin) */
  memberOrgIds: string[];
  isSuperAdmin: boolean;
  myRole: OrgRole | null;
  switchOrg: (orgId: string) => Promise<void>;
  /** Bascule d'équipe puis ouverture directe d'un espace après rechargement */
  switchOrgAndOpenSpace: (orgId: string, spaceId: string) => Promise<void>;
  /** Vrai pendant la bascule (rechargement complet en cours) */
  switching: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | null>(null);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user, teamMemberId } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [myOrgs, setMyOrgs] = useState<Organization[]>([]);
  const [memberOrgIds, setMemberOrgIds] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [myRole, setMyRole] = useState<OrgRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setCurrentOrg(null);
      setMyOrgs([]);
      setMemberOrgIds([]);
      setIsSuperAdmin(false);
      setMyRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Statut super-admin
      const { data: superAdmin } = await supabase.rpc('is_super_admin');
      const superFlag = !!superAdmin;
      setIsSuperAdmin(superFlag);

      // Appartenances de l'utilisateur
      let memberships: { org_id: string; role: string }[] = [];
      if (teamMemberId) {
        const { data } = await supabase
          .from('organization_members')
          .select('org_id, role')
          .eq('member_id', teamMemberId);
        memberships = data || [];
      }
      const membershipIds = memberships.map((m) => m.org_id);
      setMemberOrgIds(membershipIds);

      // Liste des équipes visibles (la RLS filtre déjà côté serveur)
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name, slug, color, logo_url, is_active')
        .order('name');

      let visible = (orgs || []) as Organization[];
      if (!superFlag) {
        visible = visible.filter((o) => membershipIds.includes(o.id));
      }
      setMyOrgs(visible);

      // Équipe active
      let activeId: string | null = null;
      if (teamMemberId) {
        const { data: active } = await supabase
          .from('member_active_org')
          .select('org_id')
          .eq('member_id', teamMemberId)
          .maybeSingle();
        activeId = active?.org_id ?? null;
      }

      // Initialisation pour un compte antérieur à la couche multi-équipes
      if (!activeId && visible.length > 0 && teamMemberId) {
        activeId = visible[0].id;
        await supabase
          .from('member_active_org')
          .upsert({ member_id: teamMemberId, org_id: activeId }, { onConflict: 'member_id' });
      }

      const org = visible.find((o) => o.id === activeId) ?? visible[0] ?? null;
      setCurrentOrg(org);
      if (org) {
        const membership = memberships.find((m) => m.org_id === org.id);
        setMyRole((membership?.role as OrgRole) ?? (superFlag ? 'owner' : null));
      } else {
        setMyRole(superFlag ? 'owner' : null);
      }
    } finally {
      setLoading(false);
    }
  }, [user, teamMemberId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Changement d'équipe : on recharge la page entière.
   * La RLS s'appuie sur current_org_id() côté serveur : caches React Query,
   * état d'AppContext et abonnements realtime doivent repartir de zéro.
   */
  const switchOrg = useCallback(
    async (orgId: string) => {
      if (!teamMemberId) return;
      setSwitching(true);
      try {
        await supabase
          .from('member_active_org')
          .upsert({ member_id: teamMemberId, org_id: orgId }, { onConflict: 'member_id' });
        window.location.reload();
      } catch {
        setSwitching(false);
      }
    },
    [teamMemberId]
  );

  /**
   * Bascule d'équipe avec ouverture d'un espace précis.
   * L'espace cible transite par l'URL (?space=…) car le rechargement complet
   * détruit tout état React.
   */
  const switchOrgAndOpenSpace = useCallback(
    async (orgId: string, spaceId: string) => {
      if (!teamMemberId) return;
      setSwitching(true);
      try {
        await supabase
          .from('member_active_org')
          .upsert({ member_id: teamMemberId, org_id: orgId }, { onConflict: 'member_id' });
        window.location.href = `/?space=${encodeURIComponent(spaceId)}`;
      } catch {
        setSwitching(false);
      }
    },
    [teamMemberId]
  );

  return (
    <OrgContext.Provider
      value={{
        currentOrg,
        myOrgs,
        memberOrgIds,
        isSuperAdmin,
        myRole,
        switchOrg,
        switchOrgAndOpenSpace,
        switching,
        loading,
        refresh: load,
      }}
    >
      {children}
      {/* Indicateur pendant la bascule : l'application se recharge entièrement */}
      {switching && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Changement d’équipe…</p>
        </div>
      )}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
