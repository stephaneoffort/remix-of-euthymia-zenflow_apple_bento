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
import { ArrowLeft, Plus, Trash2, Shield, Users, ListChecks, Pencil, Check, X, MessageCircle, DatabaseBackup, Crown, Palette } from 'lucide-react';
import { useThemeMode, PALETTE_META, type ThemePalette } from '@/context/ThemeContext';
import DataExportImport from '@/components/DataExportImport';
import InviteMemberDialog from '@/components/InviteMemberDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
        <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="font-bold text-foreground text-lg">Administration</h1>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        <Tabs defaultValue="members">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="members" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Membres</span>
            </TabsTrigger>
            <TabsTrigger value="statuses" className="gap-2">
              <ListChecks className="w-4 h-4" />
              <span className="hidden sm:inline">Avancements</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <DatabaseBackup className="w-4 h-4" />
              <span className="hidden sm:inline">Données</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members">
            <MembersPanel />
          </TabsContent>

          <TabsContent value="statuses">
            <StatusesPanel />
          </TabsContent>

          <TabsContent value="chat">
            <ChatCategoriesPanel />
          </TabsContent>

          <TabsContent value="data">
            <DataExportImport />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function MembersPanel() {
  const { teamMembers } = useApp();
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editName, setEditName] = useState('');
  const [members, setMembers] = useState(teamMembers);

  useEffect(() => { setMembers(teamMembers); }, [teamMembers]);

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

  const [profiles, setProfiles] = useState<{ id: string; team_member_id: string | null }[]>([]);
  useEffect(() => {
    supabase.from('profiles').select('id, team_member_id').then(({ data }) => {
      setProfiles(data || []);
    });
  }, []);

  const getUserIdForMember = (memberId: string) => {
    return profiles.find(p => p.team_member_id === memberId)?.id;
  };

  const refreshRoles = async () => {
    const { data } = await supabase.from('user_roles').select('user_id, role');
    const map: Record<string, string[]> = {};
    data?.forEach((r: any) => {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.role);
    });
    setRoles(map);
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Supprimer ce membre de l\'équipe ?')) return;
    const { error } = await supabase.from('team_members').delete().eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Membre supprimé');
      setMembers(prev => prev.filter(m => m.id !== memberId));
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
      // Prevent removing own admin role
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser && currentUser.id === userId) {
        toast.error('Vous ne pouvez pas retirer votre propre rôle administrateur');
        return;
      }
      // Count remaining admins
      const adminCount = Object.values(roles).filter(r => r.includes('admin')).length;
      if (adminCount <= 1) {
        toast.error('Impossible : il doit rester au moins un administrateur');
        return;
      }
      const member = members.find(m => m.id === memberId);
      const confirmed = confirm(`Retirer le rôle administrateur à ${member?.name ?? 'ce membre'} ? Il n'aura plus accès aux paramètres.`);
      if (!confirmed) return;
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      if (error) { toast.error(error.message); return; }
      toast.success('Rôle admin retiré');
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
      if (error) { toast.error(error.message); return; }
      toast.success('Rôle administrateur attribué avec succès');
    }
    await refreshRoles();
  };

  const startEditing = (m: typeof members[0]) => {
    setEditingMember(m.id);
    setEditRole(m.role);
    setEditName(m.name);
  };

  const cancelEditing = () => {
    setEditingMember(null);
    setEditRole('');
    setEditName('');
  };

  const handleSaveEdit = async (memberId: string) => {
    const updates: Record<string, string> = {};
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    if (editName.trim() && editName.trim() !== member.name) updates.name = editName.trim();
    if (editRole.trim() && editRole.trim() !== member.role) updates.role = editRole.trim();

    if (Object.keys(updates).length === 0) {
      cancelEditing();
      return;
    }

    const { error } = await supabase.from('team_members').update(updates).eq('id', memberId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Membre mis à jour');
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ...updates } : m));
    }
    cancelEditing();
  };

  const handleMemberAdded = () => {
    supabase.from('team_members').select('*').then(({ data }) => {
      if (data) {
        setMembers(data.map((m: any) => ({
          id: m.id, name: m.name, role: m.role,
          avatarColor: m.avatar_color, avatarUrl: m.avatar_url, email: m.email,
        })));
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Gestion des membres</CardTitle>
        <InviteMemberDialog onMemberAdded={handleMemberAdded} />
      </CardHeader>
      <CardContent className="space-y-2">
        {members.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun membre</p>
        )}
        {members.map(m => {
          const userId = getUserIdForMember(m.id);
          const memberIsAdmin = userId ? roles[userId]?.includes('admin') : false;
          const isEditing = editingMember === m.id;

          return (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className="relative shrink-0">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                {memberIsAdmin && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center ring-2 ring-background">
                    <Crown className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="flex-1 min-w-0 space-y-1.5">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Nom"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    placeholder="Fonction (ex: Développeur, Designer...)"
                    className="h-8 text-sm"
                  />
                </div>
              ) : (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm truncate">{m.name}</p>
                    {memberIsAdmin && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        <Crown className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.role} · {m.email}</p>
                </div>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                {isEditing ? (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 w-8 p-0 btn-icon-touch"
                      onClick={() => handleSaveEdit(m.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 btn-icon-touch"
                      onClick={cancelEditing}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 w-8 p-0 btn-icon-touch"
                      onClick={() => startEditing(m)}
                      title="Modifier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {userId && (
                      <Button
                        variant={memberIsAdmin ? 'default' : 'outline'}
                        size="sm"
                        className={`text-xs gap-1.5 h-8 px-3 ${memberIsAdmin ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : 'hover:border-amber-400 hover:text-amber-600'}`}
                        onClick={() => handleToggleAdmin(m.id)}
                        title={memberIsAdmin ? 'Retirer les droits admin' : 'Nommer administrateur'}
                      >
                        <Crown className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{memberIsAdmin ? 'Admin ✓' : 'Nommer Admin'}</span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0 btn-icon-touch"
                      onClick={() => handleDeleteMember(m.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
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
                   className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 btn-icon-touch"
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

interface ChatCategory {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
}

const CHAT_ICONS = ['💬', '📢', '🛟', '🎲', '🎯', '💡', '🔥', '📊', '🎨', '🤝'];

function ChatCategoriesPanel() {
  const [categories, setCategories] = useState<ChatCategory[]>([]);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('💬');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const fetchCategories = async () => {
    const { data } = await supabase.from('chat_categories').select('*').order('sort_order');
    setCategories(data || []);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const { error } = await supabase.from('chat_categories').insert({
      name: newName.trim(),
      icon: newIcon,
      sort_order: categories.length,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setNewName('');
      setNewIcon('💬');
      toast.success('Catégorie ajoutée');
      fetchCategories();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('chat_categories').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Catégorie supprimée');
      fetchCategories();
    }
  };

  const startEdit = (cat: ChatCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditIcon(cat.icon);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const { error } = await supabase.from('chat_categories').update({ name: editName.trim(), icon: editIcon }).eq('id', editingId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Catégorie modifiée');
      fetchCategories();
    }
    setEditingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Catégories du chat</CardTitle>
        <p className="text-sm text-muted-foreground">
          Gérez les canaux de discussion disponibles pour l'équipe.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-sm">
            {editingId === cat.id ? (
              <>
                <div className="flex gap-0.5 shrink-0">
                  {CHAT_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditIcon(icon)}
                      className={`w-9 h-9 rounded text-sm flex items-center justify-center transition-colors ${
                        editIcon === icon ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                  className="flex-1 h-8 text-sm"
                  autoFocus
                />
                <Button variant="default" size="sm" className="h-8 w-8 p-0 btn-icon-touch" onClick={handleSaveEdit}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0 btn-icon-touch" onClick={() => setEditingId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <>
                <span>{cat.icon}</span>
                <span className="flex-1 text-foreground">{cat.name}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0 btn-icon-touch"
                  onClick={() => startEdit(cat)}
                  title="Renommer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 btn-icon-touch"
                  onClick={() => handleDelete(cat.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}

        {/* Add new category */}
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex gap-0.5 flex-wrap">
            {CHAT_ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => setNewIcon(icon)}
                className={`w-9 h-9 rounded text-sm flex items-center justify-center transition-colors ${
                  newIcon === icon ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Nouvelle catégorie..."
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="flex-1"
            />
            <Button onClick={handleAdd} disabled={adding || !newName.trim()} size="sm" className="gap-1">
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
