import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrg, type OrgRole } from '@/context/OrgContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Trash2, UserPlus, Mail } from 'lucide-react';
import { toast } from 'sonner';

const ROLE_LABELS: Record<OrgRole, string> = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' };

interface Row { member_id: string; role: OrgRole; name: string; email: string }

export default function TeamManage() {
  const navigate = useNavigate();
  const { teamMemberId } = useAuth();
  const { currentOrg: activeOrg, myOrgs, isSuperAdmin } = useOrg();
  const [params] = useSearchParams();
  const orgParam = params.get('org');
  const currentOrg = (orgParam && myOrgs.find((o) => o.id === orgParam)) || activeOrg;
  const [rows, setRows] = useState<Row[]>([]);
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [addId, setAddId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentOrg) { setLoading(false); return; }
    setLoading(true);
    const [{ data: om }, { data: tm }] = await Promise.all([
      supabase.from('organization_members').select('member_id, role').eq('org_id', currentOrg.id),
      supabase.from('team_members').select('id, name, email').order('name'),
    ]);
    const all = tm || [];
    const ids = new Set((om || []).map((m) => m.member_id));
    setRows((om || []).map((m) => {
      const t = all.find((x) => x.id === m.member_id);
      return { member_id: m.member_id, role: m.role as OrgRole, name: t?.name ?? m.member_id, email: t?.email ?? '' };
    }).sort((a, b) => a.name.localeCompare(b.name)));
    setCandidates(all.filter((t) => !ids.has(t.id)).map((t) => ({ id: t.id, name: t.name })));
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const myRole = rows.find((r) => r.member_id === teamMemberId)?.role ?? null;
  const canManage = isSuperAdmin || myRole === 'owner' || myRole === 'admin';
  const owners = rows.filter((r) => r.role === 'owner').length;

  const changeRole = async (r: Row, role: OrgRole) => {
    if (r.role === 'owner' && role !== 'owner' && owners <= 1) return toast.error('Il faut garder au moins un propriétaire.');
    const { error } = await supabase.from('organization_members').update({ role }).eq('org_id', currentOrg!.id).eq('member_id', r.member_id);
    if (error) return toast.error("Modification refusée : vous n'avez pas les droits.");
    toast.success('Rôle mis à jour');
    load();
  };

  const remove = async (r: Row) => {
    if (r.role === 'owner' && owners <= 1) return toast.error('Impossible de retirer le dernier propriétaire.');
    if (!confirm(`Retirer ${r.name} de l'équipe ?`)) return;
    const { error } = await supabase.from('organization_members').delete().eq('org_id', currentOrg!.id).eq('member_id', r.member_id);
    if (error) return toast.error("Suppression refusée : vous n'avez pas les droits.");
    toast.success('Membre retiré');
    load();
  };

  const add = async () => {
    if (!addId) return;
    const { error } = await supabase.from('organization_members').insert({ org_id: currentOrg!.id, member_id: addId, role: 'member' });
    if (error) return toast.error("Ajout refusé : vous n'avez pas les droits.");
    toast.success('Membre ajouté');
    setAddId('');
    load();
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Retour au profil
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {currentOrg && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentOrg.color || 'hsl(var(--primary))' }} />}
              Gérer l'équipe {currentOrg?.name ?? ''}
            </CardTitle>
            {myOrgs.length > 1 && currentOrg && (
              <Select value={currentOrg.id} onValueChange={(id) => navigate(`/profile/team?org=${id}`)}>
                <SelectTrigger className="w-60 mt-2"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground">
                  {myOrgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}{o.id === activeOrg?.id ? ' (active)' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManage && (
              <p className="text-sm text-muted-foreground">Seuls les propriétaires et administrateurs peuvent modifier l'équipe.</p>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.member_id} className="flex items-center gap-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.name}{r.member_id === teamMemberId && <span className="text-muted-foreground"> (vous)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                    </div>
                    {canManage ? (
                      <>
                        <Select value={r.role} onValueChange={(v) => changeRole(r, v as OrgRole)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-popover text-popover-foreground">
                            {(Object.keys(ROLE_LABELS) as OrgRole[]).map((k) => (
                              <SelectItem key={k} value={k}>{ROLE_LABELS[k]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" onClick={() => remove(r)} aria-label={`Retirer ${r.name}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{ROLE_LABELS[r.role]}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-medium text-foreground">Ajouter un membre</p>
                <div className="flex gap-2">
                  <Select value={addId} onValueChange={setAddId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={candidates.length ? 'Choisir une personne' : 'Aucune personne disponible'} />
                    </SelectTrigger>
                    <SelectContent className="bg-popover text-popover-foreground">
                      {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={add} disabled={!addId} className="gap-2"><UserPlus className="w-4 h-4" />Ajouter</Button>
                </div>
                <Button variant="link" size="sm" className="px-0 gap-2" onClick={() => navigate('/settings/invitations')}>
                  <Mail className="w-4 h-4" /> Inviter une nouvelle personne par e-mail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
