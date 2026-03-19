import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Users } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar_color: string;
  email: string;
}

export default function SelectTeamMember() {
  const { user, teamMemberId, linkTeamMember, loading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('team_members').select('*').then(({ data }) => {
      if (data) setMembers(data);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (teamMemberId) return <Navigate to="/" replace />;

  const handleSelect = async (memberId: string) => {
    setSubmitting(true);
    const { error } = await linkTeamMember(memberId);
    setSubmitting(false);
    if (error) toast.error('Erreur lors de la liaison du profil');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Users className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Choisissez votre profil</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Sélectionnez votre membre d'équipe pour accéder à vos tâches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {members.map(m => (
            <Button
              key={m.id}
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              disabled={submitting}
              onClick={() => handleSelect(m.id)}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ backgroundColor: m.avatar_color }}
              >
                {m.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="text-left">
                <div className="font-medium text-foreground">{m.name}</div>
                <div className="text-xs text-muted-foreground">{m.role}</div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
