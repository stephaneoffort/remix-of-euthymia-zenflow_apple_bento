import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';

const AVATAR_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
];

const SelectTeamMember = React.forwardRef<HTMLDivElement>(function SelectTeamMember(_, ref) {
  const { user, teamMemberId, loading, linkTeamMember } = useAuth();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (teamMemberId) return <Navigate to="/" replace />;

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const memberId = `tm_${crypto.randomUUID()}`;

      const { error: memberError } = await supabase.from('team_members').insert({
        id: memberId,
        name: name.trim(),
        email: user.email ?? '',
        role: role.trim() || 'Membre',
        avatar_color: avatarColor,
      });

      if (memberError) throw memberError;

      const { error: linkError } = await linkTeamMember(memberId);
      if (linkError) throw linkError;

      toast.success('Profil créé avec succès ! Bienvenue sur Euthymia.');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du profil');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={ref} className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <img src="/logo-euthymia.png" alt="Euthymia" className="w-14 h-14 rounded-full object-cover" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground flex items-center justify-center gap-2">
            <UserPlus className="w-5 h-5" />
            Créer votre profil
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1 text-sm">
            Complétez votre profil pour accéder à l'application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={user.email ?? ''}
                disabled
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-name">Nom complet <span className="text-destructive">*</span></Label>
              <Input
                id="profile-name"
                type="text"
                autoComplete="name"
                autoFocus
                required
                placeholder="Marie Dupont"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-role">Fonction / Poste</Label>
              <Input
                id="profile-role"
                type="text"
                placeholder="Chef de projet, Développeur…"
                value={role}
                onChange={e => setRole(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting || !name.trim()}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création…</>
              ) : (
                'Créer mon profil'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
});

export default SelectTeamMember;
