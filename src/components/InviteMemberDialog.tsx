import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Mail, UserPlus, Copy, Check, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InviteMemberDialogProps {
  onMemberAdded: () => void;
}

// Résultat renvoyé par la Edge Function après génération du lien
interface InviteResult {
  inviteLink: string;
  linkType: string;
  orgName: string;
  existing: boolean;
  email: string;
}

export default function InviteMemberDialog({ onMemberAdded }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
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
    setResult(null);
    setCopied(false);
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

      // On affiche le message de la fonction tel quel pour rester diagnosticable
      if (data?.error) throw new Error(data.error);
      if (error) throw error;

      setResult({
        inviteLink: data?.inviteLink ?? '',
        linkType: data?.linkType ?? 'invite',
        orgName: data?.orgName ?? activeOrg.name,
        existing: !!data?.existing,
        email: email.trim(),
      });
      onMemberAdded();
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(result.inviteLink);
      setCopied(true);
      toast.success('Lien copié');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier automatiquement, sélectionnez le lien manuellement');
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
      <DialogContent className="sm:max-w-md bg-popover text-popover-foreground">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-primary" />
                Lien d'invitation généré
              </DialogTitle>
              <DialogDescription>
                {result.existing
                  ? `${result.email} a été rattaché à l'équipe ${result.orgName}.`
                  : `${result.email} a été créé et ajouté à l'équipe ${result.orgName}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 pt-2">
              <Label htmlFor="invite-link">Lien de connexion</Label>
              <div className="flex gap-2">
                <Input
                  id="invite-link"
                  readOnly
                  value={result.inviteLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button type="button" onClick={handleCopy} className="gap-1.5 shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  Copier le lien
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Aucun e-mail n'a été envoyé : transmettez ce lien manuellement au membre
                (message, e-mail personnel, chat…). Il est à usage unique et sa validité est
                limitée dans le temps — par défaut 1 heure dans ce projet.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { resetForm(); }}>
                  Inviter un autre membre
                </Button>
                <Button type="button" onClick={() => { setOpen(false); resetForm(); }}>
                  Fermer
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                Inviter dans {activeOrg?.name ?? '…'}
              </DialogTitle>
              <DialogDescription>
                Un lien d'invitation sera généré pour que le nouveau membre rejoigne l'équipe{activeOrg ? ` ${activeOrg.name}` : ''}. Vous le transmettrez vous-même.
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
                    'Génération...'
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Générer le lien
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
