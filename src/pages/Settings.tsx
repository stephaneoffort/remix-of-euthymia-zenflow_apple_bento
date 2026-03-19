import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Shield, Users, ListChecks } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CustomStatus {
  id: string;
  label: string;
  sort_order: number;
}

export default function Settings() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .then(({ data }) => {
        setIsAdmin(data && data.length > 0);
      });
  }, [user]);

  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center gap-3 px-6 bg-card">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-foreground text-lg">Administration</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              Membres
            </TabsTrigger>
            <TabsTrigger value="statuses" className="gap-2">
              <ListChecks className="w-4 h-4" />
              Avancements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <MembersPanel />
          </TabsContent>

          <TabsContent value="statuses">
            <StatusesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MembersPanel() {
  const { teamMembers } = useApp();
  const [roles, setRoles] = useState<Record<string, string[]>>({});

  useEffect(() => {
    supabase
      .from('user_roles')
      .select('user_id, role')
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        data?.forEach((r: any) => {
          if (!map[r.user_id]) map[r.user_id] = [];
          map[r.user_id].push(r.role);
        });
        setRoles(map);
      });
  }, []);

  // Get profiles to map team_member_id -> user_id
  const [profiles, setProfiles] = useState<{ id: string; team_member_id: string | null }[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, team_member_id').then(({ data }) => {
      setProfiles(data || []);
    });
  }, []);

  const getUserIdForMember = (memberId: string) => {
    return profiles.find(p => p.team_member_id === memberId)?.id;
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Supprimer ce membre de l\'équipe ?')) return;
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Membre supprimé');
      window.location.reload();
    }
  };

  const handleToggleAdmin = async (memberId: string) => {
    const userId = getUserIdForMember(memberId);
    if (!userId) {
      toast.error('Ce membre n\'a pas de compte utilisateur lié');
      return;
    }
    const isCurrentlyAdmin = roles[userId]?.includes('admin');
    if (isCurrentlyAdmin) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      if (error) { toast.error(error.message); return; }
      toast.success('Rôle admin retiré');
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
      if (error) { toast.error(error.message); return; }
      toast.success('Rôle admin attribué');
    }
    // Refresh roles
    const { data } = await supabase.from('user_roles').select('user_id, role');
    const map: Record<string, string[]> = {};
    data?.forEach((r: any) => {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.role);
    });
    setRoles(map);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Gestion des membres</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {teamMembers.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun membre</p>
        )}
        {teamMembers.map(m => {
          const userId = getUserIdForMember(m.id);
          const memberIsAdmin = userId ? roles[userId]?.includes('admin') : false;

          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
              ) : (
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: m.avatarColor }}
                >
                  {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground truncate">{m.role} · {m.email}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {userId && (
                  <Button
                    variant={memberIsAdmin ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => handleToggleAdmin(m.id)}
                  >
                    <Shield className="w-3 h-3" />
                    Admin
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDeleteMember(m.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function StatusesPanel() {
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchStatuses = async () => {
    const { data } = await supabase.from('custom_statuses').select('*').order('sort_order');
    setStatuses(data || []);
  };

  useEffect(() => { fetchStatuses(); }, []);

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('custom_statuses').insert({
      label: newLabel.trim(),
      sort_order: statuses.length,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setNewLabel('');
      toast.success('Statut ajouté');
      fetchStatuses();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('custom_statuses').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Statut supprimé');
      fetchStatuses();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Degrés d'avancement</CardTitle>
        <p className="text-sm text-muted-foreground">
          Statuts par défaut : À faire, En cours, En revue, Terminé, Bloqué. Ajoutez des statuts personnalisés ci-dessous.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Default statuses (read-only) */}
        <div className="space-y-1.5">
          {['À faire', 'En cours', 'En revue', 'Terminé', 'Bloqué'].map(s => (
            <div key={s} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 text-sm text-foreground">
              <span className="flex-1">{s}</span>
              <span className="text-xs text-muted-foreground">Par défaut</span>
            </div>
          ))}
        </div>

        {/* Custom statuses */}
        {statuses.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            {statuses.map(s => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm">
                <span className="flex-1 text-foreground">{s.label}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                  onClick={() => handleDelete(s.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Add new status */}
        <div className="flex gap-2 pt-2">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Nouveau statut..."
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={adding || !newLabel.trim()} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
