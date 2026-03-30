import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import type { MemberProfile } from '@/types/chat';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

const db = supabase as any;

interface Props {
  memberProfiles: Record<string, MemberProfile>;
  onDmCreated?: (channelId: string) => void;
  onlineTeamMemberIds?: Set<string>;
}

export function MembersPanel({ memberProfiles, onDmCreated, onlineTeamMemberIds = new Set() }: Props) {
  const { user } = useAuth();
  const { teamMembers } = useApp();
  const [showGroupDm, setShowGroupDm] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [teamMemberToAuthId, setTeamMemberToAuthId] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadMapping = async () => {
      const { data: profiles } = await supabase.from('profiles').select('id, team_member_id');
      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach(p => { if (p.team_member_id) map[p.team_member_id] = p.id; });
        setTeamMemberToAuthId(map);
      }
    };
    loadMapping();
  }, []);

  const startDm = useCallback(async (targetUserId: string, targetName: string) => {
    if (!user) return;
    const { data: existingChannels } = await db.from('chat_channels').select('id, name').eq('type', 'dm');
    if (existingChannels) {
      for (const ch of existingChannels) {
        const { data: members } = await db.from('chat_channel_members').select('user_id').eq('channel_id', ch.id);
        if (members?.length === 2) {
          const uids = members.map((m: any) => m.user_id);
          if (uids.includes(user.id) && uids.includes(targetUserId)) {
            onDmCreated?.(ch.id); return;
          }
        }
      }
    }
    const { data: newChannel, error } = await db.from('chat_channels').insert({ name: `dm-${Date.now()}`, type: 'dm', description: null }).select().single();
    if (error || !newChannel) { toast.error('Impossible de créer la conversation'); return; }
    await db.from('chat_channel_members').insert([
      { channel_id: newChannel.id, user_id: user.id },
      { channel_id: newChannel.id, user_id: targetUserId },
    ]);
    toast.success(`Conversation privée avec ${targetName}`);
    onDmCreated?.(newChannel.id);
  }, [user, onDmCreated]);

  const startGroupDm = async () => {
    if (!user || selectedForGroup.length === 0) return;
    setCreating(true);
    const names = selectedForGroup.map(id => teamMembers.find(m => m.id === id)?.name || 'Utilisateur');
    const authUserIds = selectedForGroup.map(tmId => teamMemberToAuthId[tmId]).filter(Boolean);
    if (authUserIds.length === 0) { toast.error('Membres introuvables'); setCreating(false); return; }
    const channelName = names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
    const { data: newChannel, error } = await db.from('chat_channels').insert({ name: channelName, type: 'private', description: `Groupe: ${names.join(', ')}` }).select().single();
    if (error || !newChannel) { toast.error('Impossible de créer le groupe'); setCreating(false); return; }
    await db.from('chat_channel_members').insert([
      { channel_id: newChannel.id, user_id: user.id },
      ...authUserIds.map((uid: string) => ({ channel_id: newChannel.id, user_id: uid })),
    ]);
    toast.success(`Groupe créé avec ${names.join(', ')}`);
    setShowGroupDm(false); setSelectedForGroup([]); setCreating(false);
    onDmCreated?.(newChannel.id);
  };

  const onlineList = teamMembers.filter(m => onlineTeamMemberIds.has(m.id));
  const offlineList = teamMembers.filter(m => !onlineTeamMemberIds.has(m.id));

  const handleMemberClick = (member: typeof teamMembers[0]) => {
    const authId = teamMemberToAuthId[member.id];
    const isSelf = authId === user?.id;
    if (isSelf) return;
    if (authId) {
      startDm(authId, member.name);
    } else {
      toast.info(`${member.name} n'a pas encore créé de compte. Le message sera disponible dès sa connexion.`);
    }
  };

  const renderMember = (member: typeof teamMembers[0], isOnline: boolean) => {
    const authId = teamMemberToAuthId[member.id];
    const isSelf = authId === user?.id;
    const canDm = !isSelf && !!authId;

    return (
      <button
        key={member.id}
        onClick={() => handleMemberClick(member)}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-left group ${
          canDm ? 'hover:bg-primary/10 cursor-pointer' : 'cursor-default hover:bg-muted/10'
        }`}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
            style={{ backgroundColor: member.avatarColor || '#6366f1' }}>
            {(member.name || '?')[0].toUpperCase()}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
            isOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]' : 'bg-muted-foreground/30'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] truncate font-medium ${isOnline ? 'text-foreground' : 'text-muted-foreground/60'}`}>
            {member.name}
            {isSelf && <span className="text-[10px] text-muted-foreground/40 ml-1">(vous)</span>}
          </p>
          <p className="text-[10px] text-muted-foreground/40 truncate">{member.role}</p>
        </div>
        {canDm && (
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-primary transition-all shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="w-60 border-l border-border/20 backdrop-blur-2xl bg-card/80 shrink-0 overflow-y-auto shadow-[inset_1px_0_0_rgba(255,255,255,0.06)]">
      <div className="p-3">
        <div className="flex items-center justify-between mb-4 px-2">
          <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
            Membres — {teamMembers.length}
          </h4>
          <button onClick={() => setShowGroupDm(true)}
            className="p-1 rounded-lg hover:bg-muted/30 text-muted-foreground/50 hover:text-foreground transition-all" title="Créer un groupe">
            <Users className="w-3.5 h-3.5" />
          </button>
        </div>

        {onlineList.length > 0 && (
          <>
            <p className="text-[10px] text-green-500/70 uppercase tracking-widest px-2 mb-1.5 font-semibold">
              En ligne — {onlineList.length}
            </p>
            <div className="space-y-0.5 mb-4">
              {onlineList.map(m => renderMember(m, true))}
            </div>
          </>
        )}

        {offlineList.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest px-2 mb-1.5 font-semibold">
              Hors ligne — {offlineList.length}
            </p>
            <div className="space-y-0.5">
              {offlineList.map(m => renderMember(m, false))}
            </div>
          </>
        )}

        {teamMembers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground/40">Aucun membre</p>
          </div>
        )}
      </div>

      <Dialog open={showGroupDm} onOpenChange={setShowGroupDm}>
        <DialogContent className="sm:max-w-sm backdrop-blur-2xl bg-popover/90 border-border/25 shadow-[0_16px_48px_rgba(0,0,0,0.25)]">
          <DialogHeader><DialogTitle>Créer un groupe privé</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Sélectionnez les membres :</p>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {teamMembers.map(member => (
              <label key={member.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-muted/20 cursor-pointer transition-all">
                <Checkbox checked={selectedForGroup.includes(member.id)} onCheckedChange={() =>
                  setSelectedForGroup(prev => prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id])
                } />
                <div className="relative">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: member.avatarColor || '#6366f1' }}>
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                    onlineTeamMemberIds.has(member.id) ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground/50">{member.role}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowGroupDm(false)}>Annuler</Button>
            <Button size="sm" disabled={selectedForGroup.length === 0 || creating} onClick={startGroupDm}>
              {creating ? 'Création...' : `Créer (${selectedForGroup.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
