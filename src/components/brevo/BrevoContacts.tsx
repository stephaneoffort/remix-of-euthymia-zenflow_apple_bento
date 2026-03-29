import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useBrevo } from '@/hooks/useBrevo';
import { useIntegrations } from '@/hooks/useIntegrations';
import { toast } from 'sonner';
import { Plus, Trash2, Send, Loader2, Mail } from 'lucide-react';

interface Props {
  entityType: string;
  entityId: string;
  compact?: boolean;
}

interface BrevoContact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  list_ids: number[];
}

export default function BrevoContacts({ entityType, entityId, compact }: Props) {
  const { isActive } = useIntegrations();
  const { attachContact, listContacts, detachContact, sendTransactional } = useBrevo();
  const [contacts, setContacts] = useState<BrevoContact[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  if (!isActive('brevo')) return null;

  useEffect(() => {
    fetchContacts();
  }, [entityType, entityId]);

  const fetchContacts = async () => {
    try {
      const data = await listContacts(entityType, entityId);
      setContacts(data ?? []);
    } catch {}
  };

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await attachContact(email, firstName, lastName, entityType, entityId);
      toast.success('Contact ajouté');
      setAddOpen(false);
      setEmail('');
      setFirstName('');
      setLastName('');
      fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleDetach = async (id: string) => {
    try {
      await detachContact(id);
      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contact retiré');
    } catch {}
  };

  const handleSendEmail = async (contact: BrevoContact) => {
    try {
      await sendTransactional(
        contact.email,
        `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim(),
        'Information depuis Euthymia',
        `<p>Bonjour ${contact.first_name ?? ''},</p><p>Merci pour votre inscription.</p>`
      );
      toast.success(`Email envoyé à ${contact.email}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur d\'envoi');
    }
  };

  const initials = (c: BrevoContact) => {
    const f = c.first_name?.[0] ?? '';
    const l = c.last_name?.[0] ?? c.email[0];
    return (f + l).toUpperCase();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Mail className="w-3 h-3" /> Contacts Brevo
        </p>
        <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)} className="h-6 text-xs gap-1">
          <Plus className="w-3 h-3" /> Ajouter
        </Button>
      </div>

      {contacts.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Aucun contact lié</p>
      )}

      {contacts.map(c => (
        <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border">
          <div className="w-7 h-7 rounded-full bg-[#0092FF]/15 text-[#0092FF] flex items-center justify-center text-[10px] font-bold shrink-0">
            {initials(c)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
          </div>
          <button onClick={() => handleSendEmail(c)} className="text-muted-foreground hover:text-primary" title="Envoyer un email">
            <Send className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => handleDetach(c.id)} className="text-muted-foreground hover:text-destructive" title="Retirer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un contact Brevo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Email *</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@email.com" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Prénom</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Nom</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleAdd} disabled={loading || !email.trim()} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
