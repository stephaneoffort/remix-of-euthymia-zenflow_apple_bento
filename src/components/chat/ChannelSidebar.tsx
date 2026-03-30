import { useState, useEffect, useCallback, useMemo } from 'react';
import { Hash, Lock, Plus, ChevronLeft, MessageCircle, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import type { ChatChannel, MemberProfile } from '@/types/chat';

const db = supabase as any;

interface Props {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  currentUserProfile?: MemberProfile | null;
  onChannelCreated?: () => void;
  unreadCounts?: Record<string, number>;
}

export function ChannelSidebar({ channels, activeChannelId, onSelectChannel, currentUserProfile, onChannelCreated, unreadCounts = {} }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { teamMembers } = useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [dmPickerOpen, setDmPickerOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);
  const [dmMembers, setDmMembers] = useState<Record<string, { name: string; avatarColor: string; userId: string }>>({});
  const [teamMemberToAuthId, setTeamMemberToAuthId] = useState<Record<string, string>>({});
  const [authIdToTeamMember, setAuthIdToTeamMember] = useState<Record<string, string>>({});

  const publicChannels = channels.filter(c => c.type === 'public');
  const privateChannels = channels.filter(c => c.type === 'private');
  const dmChannels = channels.filter(c => c.type === 'dm');

  // Load mapping between team members and auth users
  useEffect(() => {
    const loadMapping = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, team_member_id');
      if (profiles) {
        const tmToAuth: Record<string, string> = {};
        const authToTm: Record<string, string> = {};
        profiles.forEach(p => {
          if (p.team_member_id) {
            tmToAuth[p.team_member_id] = p.id;
            authToTm[p.id] = p.team_member_id;
          }
        });
        setTeamMemberToAuthId(tmToAuth);
        setAuthIdToTeamMember(authToTm);
      }
    };
    loadMapping();
  }, []);

  // Resolve DM channel partner names
  useEffect(() => {
    if (!user || dmChannels.length === 0 || Object.keys(authIdToTeamMember).length === 0) return;

    const resolveDmPartners = async () => {
      const newDmMembers: Record<string, { name: string; avatarColor: string; userId: string }> = {};

      for (const ch of dmChannels) {
        const { data: members } = await db.from('chat_channel_members').select('user_id').eq('channel_id', ch.id);
        if (members) {
          const partner = members.find((m: any) => m.user_id !== user.id);
          if (partner) {
            const tmId = authIdToTeamMember[partner.user_id];
            const tm = teamMembers.find(m => m.id === tmId);
            if (tm) {
              newDmMembers[ch.id] = { name: tm.name, avatarColor: tm.avatarColor, userId: partner.user_id };
            }
          }
        }
      }
      setDmMembers(newDmMembers);
    };

    resolveDmPartners();
  }, [user, dmChannels.length, authIdToTeamMember, teamMembers]);

  const handleCreate = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_àâäéèêëïîôùûüÿçœæ]/gi, '');
    if (!name) return;
    setCreating(true);
    const { error } = await db.from('chat_channels').insert({
      name, description: newDesc.trim() || null, type: newType, position: channels.length,
    });
    setCreating(false);
    if (error) {
      toast.error('Erreur lors de la création du canal');
    } else {
      toast.success(`Canal #${name} créé !`);
      setCreateOpen(false); setNewName(''); setNewDesc(''); setNewType('public');
      onChannelCreated?.();
    }
  };

  const startDm = useCallback(async (targetAuthId: string, targetName: string) => {
    if (!user) return;
    // Check existing DM
    const { data: existingChannels } = await db.from('chat_channels').select('id, name').eq('type', 'dm');
    if (existingChannels) {
      for (const ch of existingChannels) {
        const { data: members } = await db.from('chat_channel_members').select('user_id').eq('channel_id', ch.id);
        if (members?.length === 2) {
          const uids = members.map((m: any) => m.user_id);
          if (uids.includes(user.id) && uids.includes(targetAuthId)) {
            onSelectChannel(ch.id);
            setDmPickerOpen(false);
            return;
          }
        }
      }
    }
    // Create new DM
    const { data: newChannel, error } = await db.from('chat_channels').insert({
      name: `dm-${Date.now()}`, type: 'dm', description: null,
    }).select().single();
    if (error || !newChannel) { toast.error('Impossible de créer la conversation'); return; }
    await db.from('chat_channel_members').insert([
      { channel_id: newChannel.id, user_id: user.id },
      { channel_id: newChannel.id, user_id: targetAuthId },
    ]);
    toast.success(`Conversation privée avec ${targetName}`);
    setDmPickerOpen(false);
    onSelectChannel(newChannel.id);
    onChannelCreated?.();
  }, [user, onSelectChannel, onChannelCreated]);

  // Members available for new DMs
  const availableForDm = useMemo(() => {
    return teamMembers.filter(m => {
      const authId = teamMemberToAuthId[m.id];
      return authId && authId !== user?.id;
    });
  }, [teamMembers, teamMemberToAuthId, user]);

  return (
    <>
      <div className="w-64 backdrop-blur-2xl bg-card/15 border-r border-border/15 flex flex-col shrink-0 h-full shadow-[inset_-1px_0_0_rgba(255,255,255,0.03)]">
        {/* Header */}
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border/15 bg-card/20">
          <button onClick={() => navigate('/')}
            className="p-1.5 rounded-xl hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-all backdrop-blur-sm"
            title="Retour à l'accueil">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shadow-[0_0_10px_hsl(var(--primary)/0.1)]">
              <MessageCircle className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}>
              Chat d'équipe
            </h3>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-3 scrollbar-thin space-y-5">
          {/* Public channels */}
          <div>
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Canaux</span>
              <button onClick={() => setCreateOpen(true)}
                className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground/50 hover:text-primary transition-all" title="Créer un canal">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5 px-2">
              {publicChannels.map(ch => (
                <ChannelItem key={ch.id} channel={ch} isActive={activeChannelId === ch.id}
                  onClick={() => onSelectChannel(ch.id)} icon={<Hash className="w-4 h-4 shrink-0" />} unread={unreadCounts[ch.id] || 0} />
              ))}
              {publicChannels.length === 0 && (
                <p className="text-[11px] text-muted-foreground/40 px-3 py-2 italic">Aucun canal</p>
              )}
            </div>
          </div>

          {/* Private channels */}
          {privateChannels.length > 0 && (
            <div>
              <div className="flex items-center px-4 mb-2">
                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Privés</span>
              </div>
              <div className="space-y-0.5 px-2">
                {privateChannels.map(ch => (
                  <ChannelItem key={ch.id} channel={ch} isActive={activeChannelId === ch.id}
                    onClick={() => onSelectChannel(ch.id)} icon={<Lock className="w-4 h-4 shrink-0" />} />
                ))}
              </div>
            </div>
          )}

          {/* DMs section - always visible */}
          <div>
            <div className="flex items-center justify-between px-4 mb-2">
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Messages privés</span>
              <button onClick={() => setDmPickerOpen(true)}
                className="p-1 rounded-lg hover:bg-primary/10 text-muted-foreground/50 hover:text-primary transition-all" title="Nouveau message privé">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-0.5 px-2">
              {dmChannels.map(ch => {
                const partner = dmMembers[ch.id];
                return (
                  <DmItem
                    key={ch.id}
                    channelId={ch.id}
                    isActive={activeChannelId === ch.id}
                    onClick={() => onSelectChannel(ch.id)}
                    partnerName={partner?.name}
                    partnerColor={partner?.avatarColor}
                  />
                );
              })}
              {dmChannels.length === 0 && (
                <button
                  onClick={() => setDmPickerOpen(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm text-muted-foreground/40 hover:bg-muted/20 hover:text-foreground transition-all border border-dashed border-border/15"
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-xs">Démarrer une conversation</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User status footer */}
        {currentUserProfile && (
          <div className="border-t border-border/15 p-2.5">
            <div className="flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl backdrop-blur-xl bg-card/20 border border-border/15">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
                  style={{ backgroundColor: currentUserProfile.avatar_color || '#6366f1' }}>
                  {currentUserProfile.name[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card ring-1 ring-green-500/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{currentUserProfile.name}</p>
                <p className="text-[10px] text-green-500 font-medium">En ligne</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create channel dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md backdrop-blur-2xl bg-popover/90 border-border/25 text-popover-foreground shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" /> Créer un canal
            </DialogTitle>
            <DialogDescription>Les canaux servent à organiser les conversations par sujet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Nom du canal</Label>
              <Input id="channel-name" placeholder="ex: design, marketing, dev..." value={newName}
                onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-desc">Description (optionnel)</Label>
              <Input id="channel-desc" placeholder="De quoi parle ce canal ?" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newType} onValueChange={v => setNewType(v as 'public' | 'private')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public"><span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Public — visible par tous</span></SelectItem>
                  <SelectItem value="private"><span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Privé — sur invitation</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="flex-1">
                {creating ? 'Création...' : 'Créer le canal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DM picker dialog */}
      <Dialog open={dmPickerOpen} onOpenChange={setDmPickerOpen}>
        <DialogContent className="sm:max-w-sm backdrop-blur-2xl bg-popover/90 border-border/25 text-popover-foreground shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" /> Nouveau message privé
            </DialogTitle>
            <DialogDescription>Choisissez un membre pour démarrer une conversation privée.</DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1 pt-2">
            {availableForDm.map(member => (
              <button
                key={member.id}
                onClick={() => startDm(teamMemberToAuthId[member.id], member.name)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/10 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: member.avatarColor || '#6366f1' }}>
                  {member.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground/50 truncate">{member.role}</p>
                </div>
                <Mail className="w-4 h-4 text-muted-foreground/0 group-hover:text-primary transition-all shrink-0" />
              </button>
            ))}
            {availableForDm.length === 0 && (
              <p className="text-sm text-muted-foreground/50 text-center py-6">Aucun membre disponible</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChannelItem({ channel, isActive, onClick, icon }: {
  channel: ChatChannel; isActive: boolean; onClick: () => void; icon: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold backdrop-blur-xl border border-primary/15 shadow-[0_0_14px_hsl(var(--primary)/0.1),inset_0_1px_0_rgba(255,255,255,0.05)]'
          : 'text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground hover:backdrop-blur-sm'
      }`}
    >
      <span className={isActive ? 'text-primary' : 'opacity-40'}>{icon}</span>
      <span className="truncate">{channel.name}</span>
    </button>
  );
}

function DmItem({ channelId, isActive, onClick, partnerName, partnerColor }: {
  channelId: string; isActive: boolean; onClick: () => void; partnerName?: string; partnerColor?: string;
}) {
  const displayName = partnerName || 'Utilisateur';
  const color = partnerColor || '#6366f1';

  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
        isActive
          ? 'bg-primary/10 text-primary font-semibold backdrop-blur-xl border border-primary/15 shadow-[0_0_14px_hsl(var(--primary)/0.1),inset_0_1px_0_rgba(255,255,255,0.05)]'
          : 'text-muted-foreground/60 hover:bg-muted/20 hover:text-foreground hover:backdrop-blur-sm'
      }`}
    >
      <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0"
        style={{ backgroundColor: color }}>
        {displayName[0]?.toUpperCase()}
      </div>
      <span className="truncate">{displayName}</span>
    </button>
  );
}
