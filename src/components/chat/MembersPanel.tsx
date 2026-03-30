import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import type { MemberProfile } from '@/types/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

  // Build mapping team_member_id -> auth user id
  useEffect(() => {
    const loadMapping = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, team_member_id');
      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach(p => {
          if (p.team_member_id) map[p.team_member_id] = p.id;
        });
        setTeamMemberToAuthId(map);
      }
    };
    loadMapping();
  }, []);

  const startDm = useCallback(async (targetUserId: string, targetName: string) => {
    if (!user) return;

    const { data: existingChannels } = await db
      .from('chat_channels')
      .select('id, name')
      .eq('type', 'dm');

    if (existingChannels) {
      for (const ch of existingChannels) {
        const { data: members } = await db
          .from('chat_channel_members')
          .select('user_id')
          .eq('channel_id', ch.id);
        if (members?.length === 2) {
          const userIds = members.map((m: any) => m.user_id);
          if (userIds.includes(user.id) && userIds.includes(targetUserId)) {
            onDmCreated?.(ch.id);
            return;
          }
        }
      }
    }

    const { data: newChannel, error } = await db
      .from('chat_channels')
      .insert({ name: `dm-${Date.now()}`, type: 'dm', description: null })
      .select()
      .single();

    if (error || !newChannel) {
      toast.error('Impossible de créer la conversation');
      return;
    }

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

    const names = selectedForGroup.map(id => {
      const tm = teamMembers.find(m => m.id === id);
      return tm?.name || 'Utilisateur';
    });

    const authUserIds = selectedForGroup
      .map(tmId => teamMemberToAuthId[tmId])
      .filter(Boolean);

    if (authUserIds.length === 0) {
      toast.error('Membres introuvables');
      setCreating(false);
      return;
    }

    const channelName = names.length <= 3
      ? names.join(', ')
      : `${names.slice(0, 2).join(', ')} +${names.length - 2}`;

    const { data: newChannel, error } = await db
      .from('chat_channels')
      .insert({ name: channelName, type: 'private', description: `Groupe privé: ${names.join(', ')}` })
      .select()
      .single();

    if (error || !newChannel) {
      toast.error('Impossible de créer le groupe');
      setCreating(false);
      return;
    }

    const memberInserts = [
      { channel_id: newChannel.id, user_id: user.id },
      ...authUserIds.map((uid: string) => ({ channel_id: newChannel.id, user_id: uid })),
    ];
    await db.from('chat_channel_members').insert(memberInserts);

    toast.success(`Groupe privé créé avec ${names.join(', ')}`);
    setShowGroupDm(false);
    setSelectedForGroup([]);
    setCreating(false);
    onDmCreated?.(newChannel.id);
  };

  const toggleGroupMember = (memberId: string) => {
    setSelectedForGroup(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // Build full member list from teamMembers (all members, regardless of presence)
  const onlineList = teamMembers.filter(m => onlineTeamMemberIds.has(m.id));
  const offlineList = teamMembers.filter(m => !onlineTeamMemberIds.has(m.id));

  const renderMember = (member: typeof teamMembers[0], isOnline: boolean) => {
    const authId = teamMemberToAuthId[member.id];
    const isSelf = authId === user?.id;

    return (
      <DropdownMenu key={member.id}>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer text-left">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: member.avatarColor || '#6366f1' }}
              >
                {(member.name || '?')[0].toUpperCase()}
              </div>
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                  isOnline ? 'bg-green-500' : 'bg-muted-foreground/40'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate font-medium ${isOnline ? 'text-foreground' : 'text-muted-foreground'}`}>
                {member.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{member.role}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        {!isSelf && authId && (
          <DropdownMenuContent align="start" side="left" className="w-48">
            <DropdownMenuItem onClick={() => startDm(authId, member.name)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Message privé
            </DropdownMenuItem>
          </DropdownMenuContent>
        )}
      </DropdownMenu>
    );
  };

  return (
    <div className="w-60 border-l border-border/50 bg-card/30 backdrop-blur-sm shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-3">
        <div className="flex items-center justify-between mb-3 px-2">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Membres — {teamMembers.length}
          </h4>
          <button
            onClick={() => setShowGroupDm(true)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Créer un groupe privé"
          >
            <Users className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Online members */}
        {onlineList.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1 mt-2">
              En ligne — {onlineList.length}
            </p>
            <div className="space-y-0.5">
              {onlineList.map(m => renderMember(m, true))}
            </div>
          </>
        )}

        {/* Offline members */}
        {offlineList.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1 mt-3">
              Hors ligne — {offlineList.length}
            </p>
            <div className="space-y-0.5">
              {offlineList.map(m => renderMember(m, false))}
            </div>
          </>
        )}

        {teamMembers.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">Aucun membre</p>
          </div>
        )}
      </div>

      {/* Group DM Dialog */}
      <Dialog open={showGroupDm} onOpenChange={setShowGroupDm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Créer un groupe privé</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sélectionnez les membres à inclure :</p>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {teamMembers.map(member => (
              <label
                key={member.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedForGroup.includes(member.id)}
                  onCheckedChange={() => toggleGroupMember(member.id)}
                />
                <div className="relative">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: member.avatarColor || '#6366f1' }}
                  >
                    {member.name[0]?.toUpperCase()}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
                      onlineTeamMemberIds.has(member.id) ? 'bg-green-500' : 'bg-muted-foreground/40'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground">{member.role}</p>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowGroupDm(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              disabled={selectedForGroup.length === 0 || creating}
              onClick={startGroupDm}
            >
              {creating ? 'Création...' : `Créer (${selectedForGroup.length})`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
