import { useState } from 'react';
import { Hash, Lock, Plus, ChevronLeft, Circle, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ChatChannel, MemberProfile } from '@/types/chat';

interface Props {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  currentUserProfile?: MemberProfile | null;
  onChannelCreated?: () => void;
}

export function ChannelSidebar({ channels, activeChannelId, onSelectChannel, currentUserProfile, onChannelCreated }: Props) {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const publicChannels = channels.filter(c => c.type === 'public');
  const privateChannels = channels.filter(c => c.type === 'private');
  const dmChannels = channels.filter(c => c.type === 'dm');

  const handleCreate = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_àâäéèêëïîôùûüÿçœæ]/gi, '');
    if (!name) return;
    setCreating(true);
    const { error } = await (supabase as any).from('chat_channels').insert({
      name,
      description: newDesc.trim() || null,
      type: newType,
      position: channels.length,
    });
    setCreating(false);
    if (error) {
      toast.error('Erreur lors de la création du canal');
    } else {
      toast.success(`Canal #${name} créé !`);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      setNewType('public');
      onChannelCreated?.();
    }
  };

  return (
    <>
      <div className="w-64 backdrop-blur-xl bg-card/20 border-r border-border/20 flex flex-col shrink-0 h-full shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
        {/* Header with back button */}
        <div className="h-14 flex items-center gap-2 px-3 border-b border-border/20 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            title="Retour à l'accueil"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageCircle className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-bold text-foreground text-sm truncate">Chat d'équipe</h3>
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto py-3 scrollbar-thin space-y-4">
          {/* Public channels */}
          <div>
            <div className="flex items-center justify-between px-4 mb-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Canaux</span>
              <button
                onClick={() => setCreateOpen(true)}
                className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Créer un canal"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5 px-2">
              {publicChannels.map(channel => (
                <ChannelItem
                  key={channel.id}
                  channel={channel}
                  isActive={activeChannelId === channel.id}
                  onClick={() => onSelectChannel(channel.id)}
                  icon={<Hash className="w-4 h-4 shrink-0" />}
                />
              ))}
              {publicChannels.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-3 py-2 italic">Aucun canal</p>
              )}
            </div>
          </div>

          {/* Private channels */}
          {privateChannels.length > 0 && (
            <div>
              <div className="flex items-center px-4 mb-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Privés</span>
              </div>
              <div className="space-y-0.5 px-2">
                {privateChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={activeChannelId === channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    icon={<Lock className="w-4 h-4 shrink-0" />}
                  />
                ))}
              </div>
            </div>
          )}

          {/* DM channels */}
          {dmChannels.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-4 mb-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Messages directs</span>
                <button className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-0.5 px-2">
                {dmChannels.map(channel => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={activeChannelId === channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    icon={<Circle className="w-3 h-3 shrink-0 fill-green-500 text-green-500" />}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User status footer */}
        {currentUserProfile && (
          <div className="border-t border-border/50 p-2.5">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-muted/30">
              <div className="relative">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: currentUserProfile.avatar_color || '#6366f1' }}
                >
                  {currentUserProfile.name[0]?.toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card ring-1 ring-green-500/20" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{currentUserProfile.name}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">En ligne</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create channel dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-popover text-popover-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-primary" />
              Créer un canal
            </DialogTitle>
            <DialogDescription>
              Les canaux servent à organiser les conversations par sujet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Nom du canal</Label>
              <Input
                id="channel-name"
                placeholder="ex: design, marketing, dev..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-desc">Description (optionnel)</Label>
              <Input
                id="channel-desc"
                placeholder="De quoi parle ce canal ?"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newType} onValueChange={v => setNewType(v as 'public' | 'private')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Public — visible par tous</span>
                  </SelectItem>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Privé — sur invitation</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCreateOpen(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="flex-1">
                {creating ? 'Création...' : 'Créer le canal'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChannelItem({
  channel,
  isActive,
  onClick,
  icon,
}: {
  channel: ChatChannel;
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
        isActive
          ? 'bg-primary/15 text-primary font-semibold shadow-sm'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      <span className={isActive ? 'text-primary' : 'opacity-50'}>{icon}</span>
      <span className="truncate">{channel.name}</span>
    </button>
  );
}
