import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Shield, Users, ListChecks, Pencil, Check, X, MessageCircle, DatabaseBackup, Crown, Palette, BellRing, HardDrive, CalendarSync, ShieldCheck, Sparkles, FileText } from 'lucide-react';
import TaskTemplatesPanel from '@/components/settings/TaskTemplatesPanel';
import { useThemeMode, PALETTE_META, TYPE_META, type ThemePalette, type TypeVariant } from '@/context/ThemeContext';
import DataExportImport from '@/components/DataExportImport';
import { themePreviewStore } from '@/lib/themePreviewStore';
import InviteMemberDialog from '@/components/InviteMemberDialog';
import IntegrationsSettings from '@/components/settings/IntegrationsSettings';
import AdminIntegrationsPanel from '@/components/settings/AdminIntegrationsPanel';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import CalendarSyncSettingsPanel from '@/components/settings/CalendarSyncSettings';
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
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    const fromState = (location.state as any)?.settingsTab;
    if (fromState && typeof fromState === 'string') return fromState;
    const hash = window.location.hash.replace('#', '');
    if (hash) return hash;
    return 'members';
  });

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

  const navItems: { value: string; label: string; icon: React.ComponentType<any> }[] = [
    { value: 'members', label: 'Membres', icon: Users },
    { value: 'theme', label: 'Thèmes', icon: Palette },
    { value: 'templates', label: 'Modèles', icon: FileText },
    { value: 'integrations', label: 'Intégrations', icon: HardDrive },
    { value: 'calendar', label: 'Calendrier', icon: CalendarSync },
    { value: 'data', label: 'Données', icon: DatabaseBackup },
    { value: 'statuses', label: 'Avancements', icon: ListChecks },
    { value: 'push', label: 'Push', icon: BellRing },
  ];

  const activeLabel = navItems.find(i => i.value === activeTab)?.label ?? '';

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center gap-3 px-6 bg-card">
        <button onClick={() => navigate('/')} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <Shield className="w-5 h-5 text-primary" />
        <h1 className="font-display font-bold text-foreground text-lg">Administration</h1>
        {activeLabel && (
          <>
            <span className="text-muted-foreground/50 hidden sm:inline">/</span>
            <span className="text-sm text-muted-foreground hidden sm:inline">{activeLabel}</span>
          </>
        )}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dev/numeric-audit')}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Audit typographique numérique (admin)"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Audit numérique</span>
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-col md:flex-row min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <aside className="md:w-60 md:shrink-0 md:border-r md:border-border md:bg-card/40 md:min-h-[calc(100vh-3.5rem)]">
          <nav className="p-3 md:p-4 md:sticky md:top-0">
            <p className="hidden md:block text-[11px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-2 mb-2">
              Réglages
            </p>
            <TabsList className="flex md:flex-col flex-row gap-1 h-auto bg-transparent p-0 w-full overflow-x-auto md:overflow-visible">
              {navItems.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="w-full md:justify-start justify-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-colors shrink-0"
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            <TabsContent value="members" className="mt-0">
              <MembersPanel />
            </TabsContent>

            <TabsContent value="statuses" className="mt-0">
              <StatusesPanel />
            </TabsContent>

            <TabsContent value="theme" className="mt-0">
              <ThemePalettePanel />
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
              <TaskTemplatesPanel />
            </TabsContent>

            <TabsContent value="integrations" className="mt-0">
              <IntegrationsSettings />
              <div className="mt-6">
                <AdminIntegrationsPanel />
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="mt-0">
              <CalendarSyncSettingsPanel />
            </TabsContent>

            <TabsContent value="data" className="mt-0">
              <DataExportImport />
            </TabsContent>

            <TabsContent value="push" className="mt-0">
              <PushDebugPanel />
            </TabsContent>
          </div>
        </div>
      </Tabs>
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


function ThemePalettePanel() {
  const {
    palette, setPalette,
    theme, setTheme,
    designMode, setDesignMode,
    typeVariant, setTypeVariant,
    taskPanelOpacity, setTaskPanelOpacity,
  } = useThemeMode();
  const palettes = Object.entries(PALETTE_META) as [ThemePalette, typeof PALETTE_META[ThemePalette]][];
  const isBento = palette.startsWith("bento");

  // ── Preview state (hover) ─────────────────────────────────────────
  const [previewPalette, setPreviewPalette] = useState<ThemePalette | null>(null);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark' | 'mixed' | null>(null);
  const [previewType, setPreviewType] = useState<TypeVariant | null>(null);

  // Apply palette preview via root.dataset.palette without touching localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (previewPalette) {
      root.dataset.palette = previewPalette;
      root.classList.add('palette-transitioning');
    } else {
      root.dataset.palette = palette;
    }
    return () => { root.dataset.palette = palette; };
  }, [previewPalette, palette]);

  // Apply theme preview by toggling root classes
  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: 'light' | 'dark' | 'mixed') => {
      root.classList.remove('light', 'dark', 'mixed');
      root.classList.add(t === 'mixed' ? 'mixed' : t);
    };
    if (previewTheme) apply(previewTheme);
    else apply(theme);
    return () => apply(theme);
  }, [previewTheme, theme]);

  // Apply typo preview via CSS vars
  useEffect(() => {
    const root = document.documentElement;
    const meta = TYPE_META[previewType ?? typeVariant];
    root.style.setProperty('--font-display', meta.display);
    root.style.setProperty('--font-body', meta.body);
    root.style.setProperty('--font-numeric', meta.numeric);
    return () => {
      const restore = TYPE_META[typeVariant];
      root.style.setProperty('--font-display', restore.display);
      root.style.setProperty('--font-body', restore.body);
      root.style.setProperty('--font-numeric', restore.numeric);
    };
  }, [previewType, typeVariant]);

  // Sync preview state to global store so the top-bar ThemeIndicator can mirror it
  useEffect(() => {
    themePreviewStore.set({ palette: previewPalette, theme: previewTheme, type: previewType });
  }, [previewPalette, previewTheme, previewType]);

  // Reset global preview when leaving the Settings page
  useEffect(() => {
    return () => themePreviewStore.reset();
  }, []);

  // Effective values for the "Thème actuel" indicator card
  const effectivePalette = previewPalette ?? palette;
  const effectiveTheme = previewTheme ?? theme;
  const effectiveType = previewType ?? typeVariant;
  const isPreviewing = previewPalette !== null || previewTheme !== null || previewType !== null;

  const handleSelect = (key: ThemePalette) => {
    setPreviewPalette(null);
    if (key === palette) return;
    setPalette(key);
    toast.success(`Palette "${PALETTE_META[key].label}" appliquée`);
  };

  const PALETTE_GROUPS: { title: string; keys: ThemePalette[] }[] = [
    { title: "Classiques", keys: ["clubroom", "neutrals", "sapphire", "cinematic", "teal", "dunesCuivre", "crepuscule", "brumeArdoise", "prunelle", "azurProfond", "auroreCorail", "braiseNocturne"] },
    { title: "Bento 2026", keys: ["bento2026", "bentoOcean", "bentoRose", "bentoAmber", "bentoDunesCuivre", "bentoCrepuscule", "bentoBrumeArdoise", "bentoPrunelle", "bentoAzurProfond", "bentoAuroreCorail", "bentoBraiseNocturne"] },
    { title: "Soft UI (Neumorphisme)", keys: ["nmCloud", "nmMidnight", "nmSand", "nmForest", "nmLavender", "nmDeepForest", "ivoireChaud", "nmDunesCuivre", "nmCrepuscule", "nmBrumeArdoise", "nmPrunelle", "nmAzurProfond", "nmAuroreCorail", "nmBraiseNocturne"] },
  ];

  return (
    <div className="space-y-6">
      {/* ── Thème actuel ── */}
      <Card className={`shadow-sm transition-all sticky top-2 z-10 ${isPreviewing ? 'border-amber-500/60 bg-amber-50/30 dark:bg-amber-900/20' : 'border-primary/40 bg-accent/20'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <Sparkles className={`w-5 h-5 ${isPreviewing ? 'text-amber-500 animate-pulse' : 'text-primary'}`} />
            {isPreviewing ? 'Aperçu (survol)' : 'Thème actuel'}
            {isPreviewing && (
              <span className="ml-auto px-2 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-white uppercase tracking-wide">
                Prévisualisation
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* Mode */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-card transition-all ${previewTheme ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-border'}`}>
              <span className="text-sm">
                {effectiveTheme === 'light' ? '☀' : effectiveTheme === 'dark' ? '☽' : '⊙'}
              </span>
              <span className="text-sm font-medium text-foreground">
                {effectiveTheme === 'light' ? 'Clair' : effectiveTheme === 'dark' ? 'Sombre' : 'Mixte'}
              </span>
            </div>
            {/* Design mode */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
              <span className="text-sm">{designMode === 'classic' ? '⊞' : '✦'}</span>
              <span className="text-sm font-medium text-foreground">
                {designMode === 'classic' ? 'Classic' : 'Premium'}
              </span>
            </div>
            {/* Typo */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border bg-card transition-all ${previewType ? 'border-amber-500 ring-1 ring-amber-500/30' : 'border-border'}`}>
              <span className="font-display text-sm font-semibold" style={{ fontFamily: TYPE_META[effectiveType].display }}>Aa</span>
              <span className="text-sm font-medium text-foreground">{TYPE_META[effectiveType].label}</span>
            </div>
            {/* Palette */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${previewPalette ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-50/40 dark:bg-amber-900/20' : 'border-primary/50 bg-primary/5'}`}>
              <div className="flex gap-1">
                {PALETTE_META[effectivePalette].colors.slice(0, 4).map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-md border border-border/60 transition-colors" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className={`text-sm font-semibold ${previewPalette ? 'text-amber-700 dark:text-amber-400' : 'text-primary'}`}>{PALETTE_META[effectivePalette].label}</span>
            </div>
          </div>
          {isPreviewing && (
            <p className="text-xs text-muted-foreground mt-3 italic">
              💡 Cliquez pour appliquer · déplacez la souris ailleurs pour annuler
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Mode d'affichage</CardTitle>
          <p className="text-sm text-muted-foreground">Clair, sombre ou mixte (contenu clair + sidebar sombre).</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {([
              { key: "light" as const, label: "☀ Clair" },
              { key: "dark" as const, label: "☽ Sombre" },
              { key: "mixed" as const, label: "⊙ Mixte" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onMouseEnter={() => setPreviewTheme(key)}
                onMouseLeave={() => setPreviewTheme(null)}
                onFocus={() => setPreviewTheme(key)}
                onBlur={() => setPreviewTheme(null)}
                onClick={() => { setPreviewTheme(null); setTheme(key); toast.success(`Mode ${label} activé`); }}
                className={`relative flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  previewTheme === key && previewTheme !== theme
                    ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-900/30 text-foreground shadow-md ring-2 ring-amber-500/30'
                    : theme === key
                    ? 'border-primary bg-accent/40 text-foreground shadow-md ring-1 ring-primary/20'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30'
                }`}
              >
                {label}
                {theme === key && previewTheme !== key && (
                  <>
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground uppercase tracking-wide">
                      Actif
                    </span>
                  </>
                )}
                {previewTheme === key && previewTheme !== theme && (
                  <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-white uppercase tracking-wide">
                    Aperçu
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Opacité du panneau de détail — uniquement pour les thèmes Bento */}
      {isBento && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Opacité du panneau de tâche</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ajustez la transparence du fond du panneau de détail pour optimiser la lisibilité selon votre écran.
              Réservé aux thèmes Bento.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="task-panel-opacity" className="text-sm text-foreground">
                  Opacité du fond
                </Label>
                <span
                  className="text-sm font-semibold text-primary tabular-nums min-w-[3.5rem] text-right"
                  data-numeric
                >
                  {Math.round(taskPanelOpacity * 100)}%
                </span>
              </div>
              <input
                id="task-panel-opacity"
                type="range"
                min={50}
                max={100}
                step={5}
                value={Math.round(taskPanelOpacity * 100)}
                onChange={(e) => setTaskPanelOpacity(Number(e.target.value) / 100)}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-primary"
                style={{
                  background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${
                    ((taskPanelOpacity - 0.5) / 0.5) * 100
                  }%, hsl(var(--muted)) ${((taskPanelOpacity - 0.5) / 0.5) * 100}%, hsl(var(--muted)) 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50% · Verre dépoli</span>
                <span>100% · Opaque</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {[0.6, 0.75, 0.9, 1].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTaskPanelOpacity(v)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      Math.abs(taskPanelOpacity - v) < 0.001
                        ? "border-primary bg-accent/40 text-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30"
                    }`}
                  >
                    {Math.round(v * 100)}%
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mode de design */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Mode de design</CardTitle>
          <p className="text-sm text-muted-foreground">Interface classique ou neumorphique (Soft UI).</p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {([
              { key: "classic" as const, label: "⊞ Classic" },
              { key: "neumorphic" as const, label: "✦ Premium" },
            ]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setDesignMode(key); toast.success(`Mode ${label} activé`); }}
                className={`relative flex items-center gap-2 px-5 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  designMode === key
                    ? 'border-primary bg-accent/40 text-foreground shadow-md ring-1 ring-primary/20'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30 hover:bg-muted/30'
                }`}
              >
                {label}
                {designMode === key && (
                  <>
                    <span className="ml-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </span>
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-primary text-[9px] font-bold text-primary-foreground uppercase tracking-wide">
                      Actif
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Typographie */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-base">
            <span className="font-display text-xl leading-none">Aa</span>
            Typographie
          </CardTitle>
          <p className="text-sm text-muted-foreground">Choisis l'identité typographique de l'interface.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {(Object.entries(TYPE_META) as [TypeVariant, typeof TYPE_META[TypeVariant]][]).map(([key, meta]) => {
              const active = typeVariant === key;
              return (
                <button
                  key={key}
                  onMouseEnter={() => setPreviewType(key)}
                  onMouseLeave={() => setPreviewType(null)}
                  onFocus={() => setPreviewType(key)}
                  onBlur={() => setPreviewType(null)}
                  onClick={() => {
                    setPreviewType(null);
                    if (active) return;
                    setTypeVariant(key);
                    toast.success(`Typographie "${meta.label}" appliquée`);
                  }}
                  className={`group relative flex flex-col gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                    previewType === key && previewType !== typeVariant
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-900/30 shadow-md ring-2 ring-amber-500/30'
                      : active
                      ? 'border-primary bg-accent/40 shadow-md ring-1 ring-primary/20'
                      : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                  }`}
                >
                  {active && previewType !== key && (
                    <>
                      <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-primary-foreground" />
                      </span>
                      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground uppercase tracking-wide">
                        Actuel
                      </span>
                    </>
                  )}
                  {previewType === key && previewType !== typeVariant && (
                    <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-white uppercase tracking-wide">
                      Aperçu
                    </span>
                  )}
                  <div
                    className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2"
                    style={{
                      ['--font-display' as any]: meta.display,
                      ['--font-body' as any]: meta.body,
                      ['--font-numeric' as any]: meta.numeric,
                    }}
                  >
                    <p
                      className="text-2xl font-semibold text-foreground leading-tight tracking-tight"
                      style={{ fontFamily: meta.display }}
                    >
                      Bonjour, Stéphane
                    </p>
                    <p
                      className="text-sm text-muted-foreground leading-snug"
                      style={{ fontFamily: meta.body }}
                    >
                      Voici un aperçu de votre typographie corps de texte avec une lecture confortable.
                    </p>
                    <p
                      className="text-3xl font-bold text-primary tabular-nums"
                      style={{ fontFamily: meta.numeric }}
                    >
                      87%
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Palettes groupées */}
      {PALETTE_GROUPS.map(group => (
        <Card key={group.title} className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground text-base">
              <Palette className="w-5 h-5 text-primary" />
              {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {group.keys.map(key => {
                const meta = PALETTE_META[key];
                const active = palette === key;
                return (
                  <button
                    key={key}
                    onMouseEnter={() => setPreviewPalette(key)}
                    onMouseLeave={() => setPreviewPalette(null)}
                    onFocus={() => setPreviewPalette(key)}
                    onBlur={() => setPreviewPalette(null)}
                    onClick={() => handleSelect(key)}
                    className={`group relative flex flex-col gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                      previewPalette === key && previewPalette !== palette
                        ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-900/30 shadow-md ring-2 ring-amber-500/30'
                        : active
                        ? 'border-primary bg-accent/40 shadow-md ring-1 ring-primary/20'
                        : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                    }`}
                  >
                    {active && previewPalette !== key && (
                      <>
                        <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-primary-foreground" />
                        </span>
                        <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground uppercase tracking-wide">
                          Actuel
                        </span>
                      </>
                    )}
                    {previewPalette === key && previewPalette !== palette && (
                      <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-white uppercase tracking-wide">
                        Aperçu
                      </span>
                    )}
                    <div className="flex gap-1.5">
                      {meta.colors.map((c, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-lg border border-border/50"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Old IntegrationsPanel removed — replaced by IntegrationsSettings component

function PushDebugPanel() {
  const { teamMemberId } = useAuth();
  const { isSupported, isSubscribed, loading, subscribe, unsubscribe } = usePushNotifications(teamMemberId);
  const [backendSubs, setBackendSubs] = useState<any[]>([]);
  const [backendLoading, setBackendLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<string>('unknown');

  useEffect(() => {
    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!teamMemberId) { setBackendLoading(false); return; }
    (supabase as any).from('push_subscriptions').select('*').eq('member_id', teamMemberId)
      .then(({ data, error }: any) => {
        setBackendSubs(data || []);
        setBackendLoading(false);
      });
  }, [teamMemberId, isSubscribed]);

  const StatusDot = ({ ok }: { ok: boolean }) => (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-green-500' : 'bg-destructive'}`} />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          Diagnostic Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Push API supporté</span>
            <div className="flex items-center gap-2">
              <StatusDot ok={isSupported} />
              <span className="font-medium text-foreground">{isSupported ? 'Oui' : 'Non'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Permission navigateur</span>
            <div className="flex items-center gap-2">
              <StatusDot ok={browserPermission === 'granted'} />
              <span className="font-medium text-foreground">{browserPermission}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Abonnement navigateur actif</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <span className="text-muted-foreground">Chargement…</span>
              ) : (
                <>
                  <StatusDot ok={isSubscribed} />
                  <span className="font-medium text-foreground">{isSubscribed ? 'Oui' : 'Non'}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Enregistrements backend</span>
            <div className="flex items-center gap-2">
              {backendLoading ? (
                <span className="text-muted-foreground">Chargement…</span>
              ) : (
                <>
                  <StatusDot ok={backendSubs.length > 0} />
                  <span data-numeric className="font-numeric tabular-nums font-medium text-foreground">{backendSubs.length} abonnement(s)</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">Member ID</span>
            <span className="font-mono text-xs text-foreground">{teamMemberId || '—'}</span>
          </div>
        </div>

        {backendSubs.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Endpoints enregistrés :</p>
            <div className="space-y-1">
              {backendSubs.map((sub: any) => (
                <div key={sub.id} className="text-xs font-mono text-muted-foreground bg-muted/30 p-2 rounded break-all">
                  {sub.endpoint?.slice(0, 80)}…
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {!isSubscribed ? (
            <Button size="sm" onClick={async () => {
              const r = await subscribe();
              toast(r.ok ? 'Abonnement push activé ✅' : `Échec : ${r.reason}`);
              setBrowserPermission(Notification.permission);
            }}>
              Activer les notifications push
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={async () => {
              await unsubscribe();
              toast('Abonnement push supprimé');
            }}>
              Désactiver
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
