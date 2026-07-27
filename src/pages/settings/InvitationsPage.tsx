import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Copy, Check, RefreshCw, Ban, MailCheck, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Invitation {
  id: string;
  org_id: string;
  email: string;
  name: string;
  job_role: string;
  member_id: string | null;
  invite_link: string | null;
  link_type: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
  organizations?: { name: string } | null;
}

type Computed = 'pending' | 'expired' | 'accepted' | 'revoked';

const computeStatus = (inv: Invitation): Computed => {
  if (inv.status === 'revoked') return 'revoked';
  if (inv.status === 'accepted') return 'accepted';
  if (new Date(inv.expires_at).getTime() < Date.now()) return 'expired';
  return 'pending';
};

const statusMeta: Record<Computed, { label: string; className: string }> = {
  pending: { label: 'En cours', className: 'bg-primary/15 text-primary border-primary/30' },
  expired: { label: 'Expirée', className: 'bg-muted text-muted-foreground border-border' },
  accepted: { label: 'Acceptée', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' },
  revoked: { label: 'Révoquée', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

export default function InvitationsPage() {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [target, setTarget] = useState<Invitation | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('member_invitations')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setInvitations((data as Invitation[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter(
      (i) =>
        i.email.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        (i.organizations?.name ?? '').toLowerCase().includes(q),
    );
  }, [invitations, search]);

  const pendingCount = invitations.filter((i) => computeStatus(i) === 'pending').length;

  const handleCopy = async (inv: Invitation) => {
    if (!inv.invite_link) return;
    try {
      await navigator.clipboard.writeText(inv.invite_link);
      setCopiedId(inv.id);
      toast.success('Lien copié');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Copie impossible, sélectionnez le lien manuellement');
    }
  };

  const handleRevoke = async () => {
    if (!target) return;
    setRevoking(true);
    try {
      const { data, error } = await supabase.functions.invoke('revoke-invitation', {
        body: { invitation_id: target.id },
      });
      if (error) throw new Error(error.message);
      if (data && data.success === false) throw new Error(data.error || 'Révocation impossible');
      toast.success(
        data?.removedMember
          ? "Invitation révoquée et fiche membre supprimée"
          : "Invitation révoquée",
      );
      setTarget(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || String(err));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate('/settings')}>
            <ArrowLeft className="w-4 h-4" />
            Membres
          </Button>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-2xl font-semibold text-foreground">Invitations</h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount} invitation{pendingCount > 1 ? 's' : ''} en cours
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher par nom, e-mail ou équipe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <MailCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-foreground font-medium">Aucune invitation</p>
            <p className="text-sm text-muted-foreground">
              Les invitations générées depuis Paramètres → Membres apparaîtront ici.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((inv) => {
              const status = computeStatus(inv);
              const meta = statusMeta[status];
              const canRevoke = status === 'pending' || status === 'expired';
              return (
                <Card key={inv.id} className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{inv.name}</span>
                        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                        {inv.organizations?.name && (
                          <Badge variant="outline">{inv.organizations.name}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{inv.email}</p>
                      {inv.job_role && (
                        <p className="text-sm text-muted-foreground">{inv.job_role}</p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 pt-1">
                        <Clock className="w-3 h-3" />
                        Créée le {format(new Date(inv.created_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                        {' · '}
                        {status === 'expired' ? 'expirée' : 'expire'} le{' '}
                        {format(new Date(inv.expires_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {inv.invite_link && status === 'pending' && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleCopy(inv)}>
                          {copiedId === inv.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          Copier le lien
                        </Button>
                      )}
                      {canRevoke && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setTarget(inv)}
                        >
                          <Ban className="w-4 h-4" />
                          Révoquer
                        </Button>
                      )}
                    </div>
                  </div>

                  {inv.invite_link && status === 'pending' && (
                    <Input
                      readOnly
                      value={inv.invite_link}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-xs"
                    />
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!target} onOpenChange={(v) => { if (!v) setTarget(null); }}>
        <AlertDialogContent className="bg-popover text-popover-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer cette invitation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le lien envoyé à {target?.email} cessera d'être valide. Si la personne ne s'est jamais
              connectée, sa fiche membre et son rattachement à l'équipe seront également supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleRevoke(); }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? 'Révocation…' : 'Révoquer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
