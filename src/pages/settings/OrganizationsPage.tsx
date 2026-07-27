import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrg } from '@/context/OrgContext';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building2, Plus, Archive, RotateCcw, Users, Pencil, X } from 'lucide-react';

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  logo_url: string | null;
  is_active: boolean;
  memberCount: number;
  spaceCount: number;
  projectCount: number;
}

type Role = 'owner' | 'admin' | 'member';

/** Génère un slug : minuscules, sans accents, tirets */
function slugify(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'equipe';
}

export default function OrganizationsPage() {
  const { isSuperAdmin, loading: orgLoading, refresh } = useOrg();
  const { teamMembers } = useApp();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Création / édition
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', logo_url: '' });
  const [saving, setSaving] = useState(false);

  // Gestion des membres
  const [membersOrg, setMembersOrg] = useState<OrgRow | null>(null);
  const [members, setMembers] = useState<{ member_id: string; role: Role }[]>([]);
  const [addMemberId, setAddMemberId] = useState<string>('');

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      toast.error("Accès réservé aux administrateurs généraux");
      navigate('/settings', { replace: true });
    }
  }, [orgLoading, isSuperAdmin, navigate]);

  const loadOrgs = async () => {
    setLoading(true);
    const [{ data: orgData }, { data: memberData }, { data: spaceData }, { data: projectData }] =
      await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('organization_members').select('org_id'),
        supabase.from('spaces').select('org_id'),
        supabase.from('projects').select('org_id'),
      ]);

    const count = (rows: { org_id: string | null }[] | null, id: string) =>
      (rows || []).filter((r) => r.org_id === id).length;

    setOrgs(
      (orgData || []).map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        color: o.color,
        logo_url: o.logo_url,
        is_active: o.is_active,
        memberCount: count(memberData as any, o.id),
        spaceCount: count(spaceData as any, o.id),
        projectCount: count(projectData as any, o.id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (isSuperAdmin) loadOrgs();
  }, [isSuperAdmin]);

  const existingSlugs = useMemo(() => new Set(orgs.map((o) => o.slug)), [orgs]);

  const handleCreate = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      // Slug unique : on ajoute un suffixe numérique en cas de conflit
      const base = slugify(name);
      let slug = base;
      let i = 2;
      while (existingSlugs.has(slug)) {
        slug = `${base}-${i++}`;
      }

      const { data: created, error } = await supabase
        .from('organizations')
        .insert({ name, slug, color: form.color, logo_url: form.logo_url.trim() || null })
        .select('id')
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error('Une équipe porte déjà ce nom, choisissez-en un autre');
        } else {
          toast.error("Impossible de créer l'équipe");
        }
        return;
      }

      // Le créateur devient owner de la nouvelle équipe
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_member_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .maybeSingle();

      if (profile?.team_member_id) {
        await supabase
          .from('organization_members')
          .insert({ org_id: created.id, member_id: profile.team_member_id, role: 'owner' });
      }

      toast.success('Équipe créée');
      setCreateOpen(false);
      setForm({ name: '', color: '#6366f1', logo_url: '' });
      await loadOrgs();
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editOrg) return;
    const name = form.name.trim();
    if (!name) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('organizations')
      .update({ name, color: form.color })
      .eq('id', editOrg.id);
    setSaving(false);
    if (error) {
      toast.error('Mise à jour impossible');
      return;
    }
    toast.success('Équipe mise à jour');
    setEditOrg(null);
    await loadOrgs();
    await refresh();
  };

  const toggleActive = async (org: OrgRow) => {
    const { error } = await supabase
      .from('organizations')
      .update({ is_active: !org.is_active })
      .eq('id', org.id);
    if (error) {
      toast.error('Action impossible');
      return;
    }
    toast.success(org.is_active ? 'Équipe archivée' : 'Équipe réactivée');
    loadOrgs();
  };

  const openMembers = async (org: OrgRow) => {
    setMembersOrg(org);
    setAddMemberId('');
    const { data } = await supabase
      .from('organization_members')
      .select('member_id, role')
      .eq('org_id', org.id);
    setMembers((data || []) as { member_id: string; role: Role }[]);
  };

  const ownerCount = members.filter((m) => m.role === 'owner').length;

  const changeRole = async (memberId: string, role: Role) => {
    if (!membersOrg) return;
    const target = members.find((m) => m.member_id === memberId);
    if (target?.role === 'owner' && role !== 'owner' && ownerCount <= 1) {
      toast.error("Impossible de retirer le dernier propriétaire de l'équipe");
      return;
    }
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('org_id', membersOrg.id)
      .eq('member_id', memberId);
    if (error) {
      toast.error('Changement de rôle impossible');
      return;
    }
    setMembers((prev) => prev.map((m) => (m.member_id === memberId ? { ...m, role } : m)));
  };

  const removeMember = async (memberId: string) => {
    if (!membersOrg) return;
    const target = members.find((m) => m.member_id === memberId);
    if (target?.role === 'owner' && ownerCount <= 1) {
      toast.error("Impossible de retirer le dernier propriétaire de l'équipe");
      return;
    }
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', membersOrg.id)
      .eq('member_id', memberId);
    if (error) {
      toast.error('Retrait impossible');
      return;
    }
    setMembers((prev) => prev.filter((m) => m.member_id !== memberId));
    loadOrgs();
  };

  const addMember = async () => {
    if (!membersOrg || !addMemberId) return;
    const { error } = await supabase
      .from('organization_members')
      .insert({ org_id: membersOrg.id, member_id: addMemberId, role: 'member' });
    if (error) {
      toast.error(error.code === '23505' ? 'Ce membre fait déjà partie de l’équipe' : 'Ajout impossible');
      return;
    }
    setMembers((prev) => [...prev, { member_id: addMemberId, role: 'member' }]);
    setAddMemberId('');
    loadOrgs();
  };

  const memberName = (id: string) =>
    teamMembers.find((m) => m.id === id)?.name ?? 'Membre externe';

  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-primary" /> Équipes
            </h1>
            <p className="text-sm text-muted-foreground">
              Créez et administrez les équipes de l’application.
            </p>
          </div>
          <Button
            onClick={() => {
              setForm({ name: '', color: '#6366f1', logo_url: '' });
              setCreateOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Nouvelle équipe
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <div className="space-y-3">
            {orgs.map((org) => (
              <div
                key={org.id}
                className={`rounded-lg border border-border bg-card p-4 flex flex-wrap items-center gap-3 ${
                  org.is_active ? '' : 'opacity-60'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: org.color || 'hsl(var(--primary))' }}
                />
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium flex items-center gap-2">
                    {org.name}
                    {!org.is_active && (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        archivée
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {org.slug} · {org.memberCount} membre{org.memberCount > 1 ? 's' : ''} ·{' '}
                    {org.spaceCount} espace{org.spaceCount > 1 ? 's' : ''} · {org.projectCount} projet
                    {org.projectCount > 1 ? 's' : ''}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => openMembers(org)}>
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Membres
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditOrg(org);
                    setForm({ name: org.name, color: org.color || '#6366f1', logo_url: org.logo_url || '' });
                  }}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Modifier
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleActive(org)}>
                  {org.is_active ? (
                    <>
                      <Archive className="w-3.5 h-3.5 mr-1.5" /> Archiver
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Réactiver
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Création */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Nouvelle équipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Institut Cèdre"
              />
              {form.name.trim() && (
                <p className="text-xs text-muted-foreground">Identifiant : {slugify(form.name)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo (URL, optionnel)</Label>
              <Input
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Création…' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Édition */}
      <Dialog open={!!editOrg} onOpenChange={(o) => !o && setEditOrg(null)}>
        <DialogContent className="bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle>Modifier l’équipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Couleur</Label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-20 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOrg(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={saving}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Membres */}
      <Dialog open={!!membersOrg} onOpenChange={(o) => !o && setMembersOrg(null)}>
        <DialogContent className="bg-popover text-popover-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle>Membres — {membersOrg?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun membre pour l’instant.</p>
            )}
            {members.map((m) => (
              <div key={m.member_id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50">
                <span className="flex-1 text-sm truncate">{memberName(m.member_id)}</span>
                <Select value={m.role} onValueChange={(v) => changeRole(m.member_id, v as Role)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground z-50">
                    <SelectItem value="owner">Propriétaire</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="member">Membre</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removeMember(m.member_id)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Select value={addMemberId} onValueChange={setAddMemberId}>
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Ajouter un membre existant" />
              </SelectTrigger>
              <SelectContent className="bg-popover text-popover-foreground z-50">
                {teamMembers
                  .filter((tm) => !members.some((m) => m.member_id === tm.id))
                  .map((tm) => (
                    <SelectItem key={tm.id} value={tm.id}>
                      {tm.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={addMember} disabled={!addMemberId}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
