import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import AvatarUploader from './AvatarUploader';

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

  useEffect(() => {
    if (!member) return;
    setName(member.name);
    setRole(member.role);
    setEmail(member.email ?? '');
    setColor(member.avatarColor || AVATAR_COLORS[0]);
    setAvatarUrl(member.avatarUrl ?? null);
  }, [member, open]);

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
          <AvatarUploader
            memberId={member?.id ?? 'new'}
            value={avatarUrl}
            onChange={setAvatarUrl}
            fallbackColor={color}
            initials={initials}
          />

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
