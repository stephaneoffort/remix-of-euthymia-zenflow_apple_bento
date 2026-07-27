import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import MemberProfileEditor, { type EditableMember } from '@/components/settings/MemberProfileEditor';

export default function Profile() {
  const { teamMemberId } = useAuth();
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
