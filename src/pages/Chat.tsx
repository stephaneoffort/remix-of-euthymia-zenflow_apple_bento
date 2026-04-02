import { useState, useMemo, useEffect } from 'react';
import { useDiscordChat } from '@/hooks/useDiscordChat';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { SearchPanel } from '@/components/chat/SearchPanel';
import { PinnedMessagesPanel } from '@/components/chat/PinnedMessagesPanel';
import { Hash, Users, Pin, Search, Menu, X, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useApp } from '@/context/AppContext';
import { usePresence } from '@/hooks/usePresence';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeMode } from '@/context/ThemeContext';

export default function Chat() {
  const chat = useDiscordChat();
  const { teamMembers } = useApp();
  const { onlineMembers } = usePresence();
  const { designMode } = useThemeMode();
  const [showMembers, setShowMembers] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const isMobile = useIsMobile();
  const activeChannel = chat.channels.find(c => c.id === chat.activeChannelId);
  const currentUserProfile = chat.user ? chat.memberProfiles[chat.user.id] : undefined;
  const db = supabase as any;

  // Resolve DM partner display name
  const [dmPartnerInfo, setDmPartnerInfo] = useState<{ name: string; color: string } | null>(null);
  useEffect(() => {
    if (!activeChannel || activeChannel.type !== 'dm' || !chat.user) {
      setDmPartnerInfo(null);
      return;
    }
    const resolve = async () => {
      const { data: members } = await db.from('chat_channel_members').select('user_id').eq('channel_id', activeChannel.id);
      if (!members) return;
      const partner = members.find((m: any) => m.user_id !== chat.user!.id);
      if (!partner) return;
      const { data: profile } = await supabase.from('profiles').select('team_member_id').eq('id', partner.user_id).maybeSingle();
      if (!profile?.team_member_id) return;
      const tm = teamMembers.find(m => m.id === profile.team_member_id);
      if (tm) setDmPartnerInfo({ name: tm.name, color: tm.avatarColor });
    };
    resolve();
  }, [activeChannel?.id, chat.user]);

  const allMentionableMembers = useMemo(() =>
    teamMembers.map(m => ({ id: m.id, name: m.name, avatar_color: m.avatarColor, role: m.role })),
    [teamMembers]
  );

  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showPinned) setShowPinned(false);
  };
  const togglePinned = () => {
    setShowPinned(!showPinned);
    if (showSearch) setShowSearch(false);
  };

  return (
    <div className="flex h-[100dvh] relative overflow-hidden">
      {/* ── Mesh gradient background ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute inset-0 animate-[liquidMeshMoveDark_25s_ease-in-out_infinite]"
          style={{
            backgroundSize: '200% 200%',
            background:
              'radial-gradient(ellipse 80% 60% at 15% 30%, hsl(var(--primary) / 0.18) 0%, transparent 65%), ' +
              'radial-gradient(ellipse 60% 80% at 85% 70%, hsl(var(--accent) / 0.12) 0%, transparent 65%), ' +
              'radial-gradient(ellipse 70% 50% at 50% 90%, hsl(var(--primary) / 0.08) 0%, transparent 55%)',
          }}
        />
        {/* Grain */}
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* ── Channel sidebar ── */}
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
              unreadCounts={chat.unreadCounts}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Glass header */}
        <div className="h-14 border-b border-border/20 flex items-center px-4 gap-3 shrink-0 backdrop-blur-2xl bg-card/25 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_4px_16px_rgba(0,0,0,0.1)]">
          {isMobile && (
            <button onClick={() => setShowChannels(!showChannels)} className="p-1.5 rounded-xl hover:bg-muted/50 transition-all">
              {showChannels ? <X className="w-5 h-5 text-muted-foreground" /> : <Menu className="w-5 h-5 text-muted-foreground" />}
            </button>
          )}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {activeChannel?.type === 'dm' && dmPartnerInfo ? (
              <>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-[0_0_16px_rgba(0,0,0,0.15)]"
                  style={{ backgroundColor: dmPartnerInfo.color }}>
                  {dmPartnerInfo.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    {dmPartnerInfo.name}
                  </h2>
                  <p className="text-[11px] text-muted-foreground/60 truncate">Message privé</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_16px_hsl(var(--primary)/0.15)]">
                  <Hash className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-semibold text-foreground text-sm truncate" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    {activeChannel?.name || 'Sélectionner un canal'}
                  </h2>
                  {activeChannel?.description && !isMobile && (
                    <p className="text-[11px] text-muted-foreground/60 truncate">{activeChannel.description}</p>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={toggleSearch}
              className={`p-2 rounded-xl transition-all duration-200 ${
                showSearch
                  ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.12)]'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              title="Rechercher"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              onClick={togglePinned}
              className={`p-2 rounded-xl transition-all duration-200 relative ${
                showPinned
                  ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.12)]'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              title="Messages épinglés"
            >
              <Pin className="w-4 h-4" />
              {chat.pinnedMessages.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {chat.pinnedMessages.length}
                </span>
              )}
            </button>
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

        {/* Messages + right panels */}
        <div className="flex-1 flex min-h-0">
          {/* Main message column */}
          <div className="flex-1 flex flex-col min-w-0">
            <MessageList
              messages={chat.messages}
              reactions={chat.reactions}
              memberProfiles={chat.memberProfiles}
              onToggleReaction={chat.toggleReaction}
              loading={chat.loading}
              currentUserId={chat.user?.id}
              typingUsers={chat.typingUsers}
              onPin={chat.togglePin}
              pinnedMessageIds={chat.pinnedMessages.map(m => m.id)}
              onOpenThread={chat.openThread}
              onDeleteMessage={chat.deleteMessage}
              onEditMessage={chat.editMessage}
            />
            <ChatInput
              onSend={chat.sendMessage}
              channelName={activeChannel?.name || ''}
              onTyping={chat.sendTyping}
              memberProfiles={chat.memberProfiles}
              allMembers={allMentionableMembers}
            />
          </div>

          {/* Thread panel */}
          <AnimatePresence>
            {chat.threadParent && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="overflow-hidden shrink-0"
              >
                <ThreadPanel
                  parentMessage={chat.threadParent}
                  replies={chat.threadMessages}
                  memberProfiles={chat.memberProfiles}
                  onSendReply={chat.sendThreadReply}
                  onClose={chat.closeThread}
                  currentUserId={chat.user?.id}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Search panel */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="overflow-hidden shrink-0"
              >
                <SearchPanel
                  onSearch={chat.searchMessages}
                  results={chat.searchResults}
                  searching={chat.searching}
                  memberProfiles={chat.memberProfiles}
                  onClose={() => setShowSearch(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pinned messages panel */}
          <AnimatePresence>
            {showPinned && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 340, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="overflow-hidden shrink-0"
              >
                <PinnedMessagesPanel
                  messages={chat.pinnedMessages}
                  memberProfiles={chat.memberProfiles}
                  onUnpin={chat.togglePin}
                  onClose={() => setShowPinned(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Members panel */}
          <AnimatePresence>
            {showMembers && !isMobile && !chat.threadParent && !showSearch && !showPinned && (
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
