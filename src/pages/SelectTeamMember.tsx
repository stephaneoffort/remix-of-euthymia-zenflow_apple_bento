import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Mail } from 'lucide-react';

export default function SelectTeamMember() {
  const { user, teamMemberId, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (teamMemberId) return <Navigate to="/" replace />;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="flex justify-center mb-3">
            <img src="/logo-euthymia.png" alt="Euthymia" className="w-14 h-14 rounded-full object-cover" />
          </div>
          <CardTitle className="text-xl font-bold text-foreground">
            Compte non lié
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2 text-sm leading-relaxed">
            Votre compte <span className="font-medium text-foreground">{user.email}</span> n'est pas encore associé à un profil d'équipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground leading-relaxed">
            <p>Demandez à votre administrateur de vous inviter via l'adresse email associée à ce compte.</p>
          </div>

          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Mail className="w-3.5 h-3.5" />
            <span>L'invitation se fait depuis Paramètres → Membres</span>
          </div>

          <Button variant="outline" className="w-full" onClick={() => signOut()}>
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
