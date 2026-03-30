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
import { usePresence } from '@/hooks/usePresence';
import type { MemberProfile } from '@/types/chat';
import { motion, AnimatePresence } from 'framer-motion';

export default function Chat() {
  const chat = useDiscordChat();
  const { teamMembers } = useApp();
  const { onlineMembers } = usePresence();
  const [showMembers, setShowMembers] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const isMobile = useIsMobile();
  const activeChannel = chat.channels.find(c => c.id === chat.activeChannelId);
  const currentUserProfile = chat.user ? chat.memberProfiles[chat.user.id] : undefined;

  const allMentionableMembers = useMemo(() =>
    teamMembers.map(m => ({ id: m.id, name: m.name, avatar_color: m.avatarColor, role: m.role })),
    [teamMembers]
  );

  return (
    <div className="flex h-[100dvh] relative overflow-hidden">
      {/* Animated mesh gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: 'radial-gradient(ellipse at 20% 50%, hsl(var(--primary) / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, hsl(var(--accent) / 0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, hsl(var(--primary) / 0.08) 0%, transparent 50%)',
          }}
        />
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* Channel sidebar */}
      <AnimatePresence>
        {(!isMobile || showChannels) && (
          <motion.div
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main message area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Glass Header */}
        <div className="h-14 border-b border-border/30 flex items-center px-4 gap-3 shrink-0 backdrop-blur-xl bg-card/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          {isMobile && (
            <button onClick={() => setShowChannels(!showChannels)} className="p-1.5 rounded-xl hover:bg-muted/50 backdrop-blur-sm transition-all">
              {showChannels ? <X className="w-5 h-5 text-muted-foreground" /> : <Menu className="w-5 h-5 text-muted-foreground" />}
            </button>
          )}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_hsl(var(--primary)/0.15)]">
              <Hash className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                {activeChannel?.name || 'Sélectionner un canal'}
              </h2>
              {activeChannel?.description && !isMobile && (
                <p className="text-[11px] text-muted-foreground/70 truncate">{activeChannel.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {[
              { icon: Search, title: 'Rechercher' },
              { icon: Pin, title: 'Messages épinglés' },
            ].map(({ icon: Icon, title }) => (
              <button
                key={title}
                className="p-2 rounded-xl hover:bg-muted/40 text-muted-foreground hover:text-foreground backdrop-blur-sm transition-all duration-200"
                title={title}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
            {!isMobile && (
              <button
                onClick={() => setShowMembers(!showMembers)}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  showMembers
                    ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.12)]'
                    : 'text-muted-foreground hover:bg-muted/40'
                }`}
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
              allMembers={allMentionableMembers}
            />
          </div>
          <AnimatePresence>
            {showMembers && !isMobile && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 240, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="overflow-hidden"
              >
                <MembersPanel
                  memberProfiles={chat.memberProfiles}
                  onlineTeamMemberIds={onlineMembers}
                  onDmCreated={(channelId) => {
                    chat.setActiveChannelId(channelId);
                    chat.loadChannels();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
