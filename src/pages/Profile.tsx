import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import MemberProfileEditor, { type EditableMember } from '@/components/settings/MemberProfileEditor';
import { useOrg } from '@/context/OrgContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ROLE_LABELS = { owner: 'Propriétaire', admin: 'Administrateur', member: 'Membre' } as const;

export default function Profile() {
  const { teamMemberId } = useAuth();
  const { currentOrg, myOrgs, myRole, isSuperAdmin, switchOrg, switching } = useOrg();
  const navigate = useNavigate();
  const [member, setMember] = useState<EditableMember | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamMemberId) { setLoading(false); return; }
    supabase
      .from('team_members')
      .select('*')
      .eq('id', teamMemberId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMember({
            id: data.id,
            name: data.name,
            role: data.role,
            email: data.email,
            avatarColor: data.avatar_color,
            avatarUrl: (data as any).avatar_url ?? null,
          });
        }
        setLoading(false);
      });
  }, [teamMemberId]);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Retour aux tâches
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mon profil</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : !member ? (
              <p className="text-sm text-muted-foreground">Fiche membre introuvable.</p>
            ) : (
              <div className="flex items-center gap-4">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.name} className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white"
                    style={{ backgroundColor: member.avatarColor }}
                  >
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{member.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{member.role} · {member.email}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => setEditing(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Équipe active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!currentOrg ? (
              <p className="text-sm text-muted-foreground">Aucune équipe rattachée à ce compte.</p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentOrg.color || 'hsl(var(--primary))' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{currentOrg.name}</p>
                  {myRole && <p className="text-sm text-muted-foreground">{ROLE_LABELS[myRole]}</p>}
                </div>
              </div>
            )}
            {myOrgs.length > 1 && currentOrg && (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Changer d'équipe :</p>
                <Select value={currentOrg.id} onValueChange={(id) => id !== currentOrg.id && switchOrg(id)} disabled={switching}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground">
                    {myOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {isSuperAdmin && (
              <Button size="sm" variant="outline" onClick={() => navigate('/settings/organizations')}>
                Gérer les équipes
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <MemberProfileEditor
        member={member}
        open={editing}
        onOpenChange={setEditing}
        onSaved={setMember}
      />
    </div>
  );
}
