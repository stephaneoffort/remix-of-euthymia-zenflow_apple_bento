import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';

export default function Auth() {
  const { user, loading } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(signupEmail, signupPassword);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Vérifiez votre email pour confirmer votre inscription');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">Euthymia</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Connectez-vous pour accéder à vos tâches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Inscription</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Mot de passe</Label>
                  <Input id="login-password" type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Connexion...' : 'Se connecter'}
                </Button>

                <div className="relative my-2">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">ou</span>
                </div>

                <OAuthButtons />
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe</Label>
                  <Input id="signup-password" type="password" required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmer le mot de passe</Label>
                  <Input id="signup-confirm" type="password" required value={signupConfirm} onChange={e => setSignupConfirm(e.target.value)} placeholder="••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Inscription...' : "S'inscrire"}
                </Button>

                <div className="relative my-2">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">ou</span>
                </div>

                <OAuthButtons />
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
