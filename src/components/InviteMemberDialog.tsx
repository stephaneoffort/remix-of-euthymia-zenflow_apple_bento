import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AVATAR_COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

interface InviteMemberDialogProps {
  onMemberAdded: () => void;
}

export default function InviteMemberDialog({ onMemberAdded }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !role.trim()) {
      toast.error('Tous les champs sont requis');
      return;
    }

    setSubmitting(true);
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const memberId = `tm_${crypto.randomUUID()}`;

    const { error } = await supabase.from('team_members').insert({
      id: memberId,
      name: name.trim(),
      email: email.trim(),
      role: role.trim(),
      avatar_color: avatarColor,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Membre ajouté avec succès');
      resetForm();
      setOpen(false);
      onMemberAdded();
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Inviter un membre
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Inviter un nouveau membre</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nom complet</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jean Dupont"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean@exemple.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Fonction</Label>
            <Input
              id="invite-role"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Développeur, Designer..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Ajout...' : 'Ajouter'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
