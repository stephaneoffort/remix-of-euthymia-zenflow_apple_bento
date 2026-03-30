import { Hash, Lock, Plus, Settings, Circle } from 'lucide-react';
import type { ChatChannel, MemberProfile } from '@/types/chat';

interface Props {
  channels: ChatChannel[];
  activeChannelId: string | null;
  onSelectChannel: (id: string) => void;
  currentUserProfile?: MemberProfile | null;
  onCreateChannel?: () => void;
}

export function ChannelSidebar({ channels, activeChannelId, onSelectChannel, currentUserProfile, onCreateChannel }: Props) {
  const publicChannels = channels.filter(c => c.type === 'public');
  const privateChannels = channels.filter(c => c.type === 'private');
  const dmChannels = channels.filter(c => c.type === 'dm');

  return (
    <div className="w-60 bg-muted/20 border-r flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b shadow-sm">
        <h3 className="font-bold text-foreground text-sm tracking-tight">💬 Euthymia Chat</h3>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {/* Public channels */}
        <div className="px-2 mb-1">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Canaux</span>
            <button
              onClick={onCreateChannel}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Créer un canal"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {publicChannels.map(channel => (
          <ChannelItem
            key={channel.id}
            channel={channel}
            isActive={activeChannelId === channel.id}
            onClick={() => onSelectChannel(channel.id)}
            icon={<Hash className="w-4 h-4 shrink-0 opacity-60" />}
          />
        ))}

        {/* Private channels */}
        {privateChannels.length > 0 && (
          <>
            <div className="px-2 mt-4 mb-1">
              <div className="flex items-center px-2 py-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Privés</span>
              </div>
            </div>
            {privateChannels.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannelId === channel.id}
                onClick={() => onSelectChannel(channel.id)}
                icon={<Lock className="w-4 h-4 shrink-0 opacity-60" />}
              />
            ))}
          </>
        )}

        {/* DM channels */}
        {dmChannels.length > 0 && (
          <>
            <div className="px-2 mt-4 mb-1">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Messages directs</span>
                <button className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {dmChannels.map(channel => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                isActive={activeChannelId === channel.id}
                onClick={() => onSelectChannel(channel.id)}
                icon={<Circle className="w-3 h-3 shrink-0 fill-green-500 text-green-500" />}
              />
            ))}
          </>
        )}
      </div>

      {/* User status footer */}
      {currentUserProfile && (
        <div className="border-t p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: currentUserProfile.avatar_color || '#6366f1' }}
              >
                {currentUserProfile.name[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{currentUserProfile.name}</p>
              <p className="text-[10px] text-muted-foreground">🟢 En ligne</p>
            </div>
            <button className="p-1 rounded hover:bg-muted text-muted-foreground">
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
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
      className={`w-[calc(100%-0.5rem)] flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md text-sm transition-all duration-150 ${
        isActive
          ? 'bg-primary/15 text-primary font-semibold'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      {icon}
      <span className="truncate">{channel.name}</span>
    </button>
  );
}
