import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Mail, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  onMemberAdded: () => void;
}

export default function InviteMemberDialog({ onMemberAdded }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Équipe active de l'utilisateur (cible de l'invitation)
  const [activeOrg, setActiveOrg] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const loadActiveOrg = async () => {
      const { data } = await supabase
        .from('member_active_org')
        .select('org_id, organizations(id, name)')
        .maybeSingle();
      const org = (data as any)?.organizations;
      if (org) setActiveOrg({ id: org.id, name: org.name });
    };
    loadActiveOrg();
  }, []);

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
    if (!activeOrg) {
      toast.error("Aucune équipe active détectée");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-member', {
        body: {
          email: email.trim(),
          name: name.trim(),
          role: role.trim(),
          org_id: activeOrg.id,
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const orgName = data?.orgName ?? activeOrg.name;
      toast.success(`Invitation envoyée à ${email.trim()}`, {
        description: `Le membre recevra un email pour rejoindre ${orgName}.`,
      });
      resetForm();
      setOpen(false);
      onMemberAdded();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'invitation");
    } finally {
      setSubmitting(false);
    }
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
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Inviter dans {activeOrg?.name ?? '…'}
          </DialogTitle>
          <DialogDescription>
            Un email d'invitation sera envoyé au nouveau membre pour qu'il rejoigne l'équipe{activeOrg ? ` ${activeOrg.name}` : ''}.
          </DialogDescription>

        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email *</Label>
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
            <Label htmlFor="invite-name">Nom complet *</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jean Dupont"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Fonction *</Label>
            <Input
              id="invite-role"
              value={role}
              onChange={e => setRole(e.target.value)}
              placeholder="Formateur, Manager..."
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {submitting ? (
                'Envoi...'
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
