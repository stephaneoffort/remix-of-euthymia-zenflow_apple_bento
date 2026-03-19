import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Sparkles, Camera, X } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';

const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#6366f1', '#f59e0b'];

export default function Auth() {
  const { user, teamMemberId, loading } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // Signup fields
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [avatarColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp, linkTeamMember } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user && teamMemberId) return <Navigate to="/" replace />;
  if (user && !teamMemberId) return <Navigate to="/select-member" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setSubmitting(false);
    if (error) toast.error(error.message);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La photo ne doit pas dépasser 5 Mo');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
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
    if (!firstName.trim() || !lastName.trim() || !role.trim() || !username.trim()) {
      toast.error('Veuillez remplir tous les champs du profil');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the auth account
      const { error: signUpError } = await signUp(signupEmail, signupPassword);
      if (signUpError) throw signUpError;

      // Store profile data in localStorage so it can be created after email confirmation
      const profileData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: role.trim(),
        username: username.trim(),
        avatarColor,
        email: signupEmail,
      };
      localStorage.setItem('pending_profile', JSON.stringify(profileData));

      // Store avatar file as base64 if provided
      if (avatarFile) {
        const reader = new FileReader();
        reader.onload = () => {
          localStorage.setItem('pending_avatar', reader.result as string);
          localStorage.setItem('pending_avatar_name', avatarFile.name);
        };
        reader.readAsDataURL(avatarFile);
      }

      toast.success('Vérifiez votre email pour confirmer votre inscription. Votre profil sera créé automatiquement.');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

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
                {/* Avatar */}
                <div className="flex justify-center">
                  <div className="relative group">
                    {avatarPreview ? (
                      <div className="relative">
                        <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
                        <button type="button" onClick={() => { setAvatarFile(null); setAvatarPreview(null); }} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold text-white border-2 border-border" style={{ backgroundColor: avatarColor }}>
                        {initials || '?'}
                      </div>
                    )}
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <Camera className="w-5 h-5 text-white" />
                      <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center -mt-2">Cliquez pour ajouter une photo</p>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">Prénom *</Label>
                    <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jean" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Nom *</Label>
                    <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Dupont" required />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <Label htmlFor="role">Fonction *</Label>
                  <Input id="role" value={role} onChange={e => setRole(e.target.value)} placeholder="Formateur, Manager..." required />
                </div>

                {/* Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="username">Identifiant *</Label>
                  <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="jean.dupont" required />
                  <p className="text-xs text-muted-foreground">Votre identifiant unique dans l'application</p>
                </div>

                <Separator />

                {/* Email & Password */}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input id="signup-email" type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Mot de passe *</Label>
                  <Input id="signup-password" type="password" required value={signupPassword} onChange={e => setSignupPassword(e.target.value)} placeholder="••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmer le mot de passe *</Label>
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

function OAuthButtons() {
  const handleOAuth = async (provider: 'google' | 'apple') => {
    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error((error as Error).message || 'Erreur de connexion');
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('google')}>
        <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
        Continuer avec Google
      </Button>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={() => handleOAuth('apple')}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
        Continuer avec Apple
      </Button>
    </div>
  );
}
