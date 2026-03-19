import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { UserPlus, Camera, X } from 'lucide-react';

const AVATAR_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#6366f1', '#f59e0b'];

export default function SelectTeamMember() {
  const { user, teamMemberId, linkTeamMember, loading } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [avatarColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Pre-fill from OAuth user metadata (Google, Apple, etc.)
  useEffect(() => {
    if (!user) return;
    const meta = user.user_metadata;
    if (meta?.full_name) {
      const parts = (meta.full_name as string).split(' ');
      if (!firstName) setFirstName(parts[0] || '');
      if (!lastName) setLastName(parts.slice(1).join(' ') || '');
    }
    if (meta?.avatar_url && !avatarPreview) {
      setAvatarPreview(meta.avatar_url as string);
    }
    if (user.email && !username) {
      setUsername(user.email.split('@')[0]);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (teamMemberId) return <Navigate to="/" replace />;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !role.trim() || !username.trim()) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const memberId = `tm_${Date.now()}`;
      let avatarUrl: string | null = null;

      // Upload avatar if file provided, or use OAuth avatar URL
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `${user.id}/${memberId}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      } else if (avatarPreview && avatarPreview.startsWith('http')) {
        // Use OAuth provider avatar URL directly
        avatarUrl = avatarPreview;
      }

      // Create team member
      const { error: memberErr } = await supabase.from('team_members').insert({
        id: memberId,
        name: fullName,
        role: role.trim(),
        avatar_color: avatarColor,
        avatar_url: avatarUrl,
        email: user.email || username.trim(),
      });
      if (memberErr) throw memberErr;

      // Link to profile
      const { error: linkErr } = await linkTeamMember(memberId);
      if (linkErr) throw linkErr;

      toast.success('Profil créé avec succès !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création du profil');
    } finally {
      setSubmitting(false);
    }
  };

  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <UserPlus className="w-6 h-6 text-primary" />
            <CardTitle className="text-xl font-bold text-foreground">Créez votre profil</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Complétez vos informations pour accéder à Euthymia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="relative group">
                {avatarPreview ? (
                  <div className="relative">
                    <img
                      src={avatarPreview}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover border-2 border-border"
                    />
                    <button
                      type="button"
                      onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-border"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials || '?'}
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">Cliquez pour ajouter une photo</p>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jean"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Dupont"
                  required
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="role">Fonction *</Label>
              <Input
                id="role"
                value={role}
                onChange={e => setRole(e.target.value)}
                placeholder="Formateur, Manager, Développeur..."
                required
              />
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="username">Identifiant *</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="jean.dupont"
                required
              />
              <p className="text-xs text-muted-foreground">Votre identifiant unique dans l'application</p>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Création en cours...' : 'Créer mon profil'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
