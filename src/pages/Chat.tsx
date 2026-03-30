import { useState, useMemo } from 'react';
import { useDiscordChat } from '@/hooks/useDiscordChat';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { Hash, Users, Pin, Search, Menu, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useApp } from '@/context/AppContext';
import type { MemberProfile } from '@/types/chat';

export default function Chat() {
  const chat = useDiscordChat();
  const [showMembers, setShowMembers] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const isMobile = useIsMobile();
  const activeChannel = chat.channels.find(c => c.id === chat.activeChannelId);
  const currentUserProfile = chat.user ? chat.memberProfiles[chat.user.id] : undefined;

  return (
    <div className="flex h-[100dvh] bg-background">
      {/* Channel sidebar */}
      {(!isMobile || showChannels) && (
        <ChannelSidebar
          channels={chat.channels}
          activeChannelId={chat.activeChannelId}
          onSelectChannel={(id) => {
            chat.setActiveChannelId(id);
            if (isMobile) setShowChannels(false);
          }}
          currentUserProfile={currentUserProfile || null}
          onChannelCreated={() => chat.loadChannels()}
        />
      )}

      {/* Main message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border/50 flex items-center px-4 gap-3 shrink-0 bg-card/40 backdrop-blur-sm">
          {isMobile && (
            <button onClick={() => setShowChannels(!showChannels)} className="p-1.5 rounded-lg hover:bg-muted">
              {showChannels ? <X className="w-5 h-5 text-muted-foreground" /> : <Menu className="w-5 h-5 text-muted-foreground" />}
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground text-sm truncate">
                {activeChannel?.name || 'Sélectionner un canal'}
              </h2>
              {activeChannel?.description && !isMobile && (
                <p className="text-xs text-muted-foreground truncate">{activeChannel.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Rechercher">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Messages épinglés">
              <Pin className="w-4 h-4" />
            </button>
            {!isMobile && (
              <button
                onClick={() => setShowMembers(!showMembers)}
                className={`p-2 rounded-lg hover:bg-muted transition-colors ${showMembers ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                title="Membres"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages + Members */}
        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <MessageList
              messages={chat.messages}
              reactions={chat.reactions}
              memberProfiles={chat.memberProfiles}
              onToggleReaction={chat.toggleReaction}
              loading={chat.loading}
              currentUserId={chat.user?.id}
              typingUsers={chat.typingUsers}
            />
            <ChatInput
              onSend={chat.sendMessage}
              channelName={activeChannel?.name || ''}
              onTyping={chat.sendTyping}
              memberProfiles={chat.memberProfiles}
            />
          </div>
          {showMembers && !isMobile && (
            <MembersPanel memberProfiles={chat.memberProfiles} />
          )}
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
