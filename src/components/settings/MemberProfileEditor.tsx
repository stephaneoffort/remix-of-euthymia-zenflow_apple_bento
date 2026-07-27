import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Upload, Trash2 } from 'lucide-react';

export interface EditableMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string | null;
}

export const AVATAR_COLORS = [
  '#6366f1', '#f43f5e', '#10b981', '#f59e0b',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#155E75', '#F4633A', '#64748b', '#0ea5e9',
];

const TEN_YEARS = 60 * 60 * 24 * 3650;

interface Props {
  member: EditableMember | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (member: EditableMember) => void;
}

export default function MemberProfileEditor({ member, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setRole(member.role);
    setEmail(member.email ?? '');
    setColor(member.avatarColor || AVATAR_COLORS[0]);
    setAvatarUrl(member.avatarUrl ?? null);
  }, [member, open]);

  const handleUpload = async (file: File) => {
    if (!member) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez choisir une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (5 Mo max)');
      return;
    }
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error('Session expirée');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${uid}/${member.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: signErr } = await supabase.storage.from('avatars').createSignedUrl(path, TEN_YEARS);
      if (signErr) throw signErr;
      setAvatarUrl(signed?.signedUrl ?? null);
      toast.success('Photo chargée — pensez à enregistrer');
    } catch (err: any) {
      toast.error(err.message || "Échec de l'envoi de l'image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!member) return;
    if (!name.trim()) {
      toast.error('Le nom est obligatoire');
      return;
    }
    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        role: role.trim() || 'Membre',
        email: email.trim(),
        avatar_color: color,
        avatar_url: avatarUrl,
      };
      const { error } = await supabase.from('team_members').update(updates).eq('id', member.id);
      if (error) throw error;
      onSaved({
        id: member.id,
        name: updates.name,
        role: updates.role,
        email: updates.email,
        avatarColor: updates.avatar_color,
        avatarUrl: updates.avatar_url,
      });
      toast.success('Fiche membre mise à jour');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message?.includes('row-level security')
        ? "Vous n'avez pas le droit de modifier cette fiche"
        : err.message || 'Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modifier la fiche membre</DialogTitle>
          <DialogDescription>
            Nom, fonction, e-mail de contact, photo et couleur d'avatar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt={name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Changer la photo
              </Button>
              {avatarUrl && (
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setAvatarUrl(null)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Retirer la photo
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-name">Nom</Label>
            <Input id="member-name" value={name} onChange={e => setName(e.target.value)} placeholder="Nom complet" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-role">Fonction</Label>
            <Input id="member-role" value={role} onChange={e => setRole(e.target.value)} placeholder="Ex : Développeur" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-email">E-mail de contact</Label>
            <Input id="member-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="prenom.nom@exemple.fr" />
            <p className="text-xs text-muted-foreground">
              Cet e-mail sert à l'affichage et aux notifications ; il ne modifie pas votre identifiant de connexion.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Couleur d'avatar</Label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Couleur ${c}`}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-primary ring-offset-background scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
