import { useState, useMemo, useEffect } from 'react';
import { useDiscordChat } from '@/hooks/useDiscordChat';
import { ChannelSidebar } from '@/components/chat/ChannelSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { MembersPanel } from '@/components/chat/MembersPanel';
import { ThreadPanel } from '@/components/chat/ThreadPanel';
import { SearchPanel } from '@/components/chat/SearchPanel';
import { PinnedMessagesPanel } from '@/components/chat/PinnedMessagesPanel';
import { Hash, Users, Pin, Search, Menu, X, MessageCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import { useApp } from '@/context/AppContext';
import { usePresence } from '@/hooks/usePresence';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeMode } from '@/context/ThemeContext';
import AppSidebar from '@/components/AppSidebar';
import SidebarNM from '@/components/SidebarNM';
import { PanelLeft } from 'lucide-react';

export default function Chat() {
  const chat = useDiscordChat();
  const { teamMembers, sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { onlineMembers } = usePresence();
  const { designMode } = useThemeMode();
  const [showMembers, setShowMembers] = useState(true);
  const [showChannels, setShowChannels] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMobileMembers, setShowMobileMembers] = useState(false);
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
    if (isMobile && showMobileMembers) setShowMobileMembers(false);
  };
  const togglePinned = () => {
    setShowPinned(!showPinned);
    if (showSearch) setShowSearch(false);
    if (isMobile && showMobileMembers) setShowMobileMembers(false);
  };
  const toggleMobileMembers = () => {
    setShowMobileMembers(!showMobileMembers);
    if (showSearch) setShowSearch(false);
    if (showPinned) setShowPinned(false);
  };

  // Close thread on mobile when opening other panels
  const hasMobileOverlay = isMobile && (showSearch || showPinned || showMobileMembers || !!chat.threadParent);

  return (
    <div className={`flex h-[100dvh] relative overflow-hidden ${designMode === "neumorphic" ? "nm-chat" : ""}`}>
      {/* ── Main app sidebar (persistent, like Index) ── */}
      {!isMobile && !sidebarCollapsed && (
        designMode === "neumorphic" ? <SidebarNM /> : <AppSidebar />
      )}
      {!isMobile && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-md bg-card/80 backdrop-blur-md border border-border hover:bg-muted transition-colors"
          title="Afficher la barre latérale"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      <div className="flex-1 flex h-full relative overflow-hidden min-w-0">
      {/* ── Mesh gradient background ── */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-background" />
        <div
          className="absolute inset-0 animate-[bentoMeshMoveDark_25s_ease-in-out_infinite]"
          style={{
            backgroundSize: '200% 200%',
            background:
              'radial-gradient(ellipse 80% 60% at 15% 30%, hsl(var(--primary) / 0.18) 0%, transparent 65%), ' +
              'radial-gradient(ellipse 60% 80% at 85% 70%, hsl(var(--accent) / 0.12) 0%, transparent 65%), ' +
              'radial-gradient(ellipse 70% 50% at 50% 90%, hsl(var(--primary) / 0.08) 0%, transparent 55%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.02] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* ── Channel sidebar ── */}
      <AnimatePresence>
        {(!isMobile || showChannels) && (
          <>
            {/* Mobile: backdrop overlay */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setShowChannels(false)}
              />
            )}
            <motion.div
              initial={isMobile ? { x: '-100%' } : { x: -280, opacity: 0 }}
              animate={isMobile ? { x: 0 } : { x: 0, opacity: 1 }}
              exit={isMobile ? { x: '-100%' } : { x: -280, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={isMobile ? 'fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[320px]' : ''}
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
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`border-b border-border/20 flex items-center px-3 gap-2 shrink-0 backdrop-blur-2xl bg-card/25 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_4px_16px_rgba(0,0,0,0.1)] ${isMobile ? 'h-12' : 'h-14 px-4 gap-3'}`}>
          {isMobile && (
            <button onClick={() => setShowChannels(true)} className="p-1.5 rounded-xl hover:bg-muted/50 transition-all shrink-0">
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {activeChannel?.type === 'dm' && dmPartnerInfo ? (
              <>
                <div className={`${isMobile ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-[11px]'} rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-[0_0_16px_rgba(0,0,0,0.15)]`}
                  style={{ backgroundColor: dmPartnerInfo.color }}>
                  {dmPartnerInfo.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className={`font-display font-semibold text-foreground truncate ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
                    {dmPartnerInfo.name}
                  </h2>
                  {!isMobile && <p className="text-[11px] text-muted-foreground/60 truncate">Message privé</p>}
                </div>
              </>
            ) : (
              <>
                <div className={`${isMobile ? 'w-7 h-7' : 'w-8 h-8'} rounded-xl bg-primary/10 backdrop-blur-sm border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_16px_hsl(var(--primary)/0.15)]`}>
                  <Hash className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-primary`} />
                </div>
                <div className="min-w-0">
                  <h2 className={`font-display font-semibold text-foreground truncate ${isMobile ? 'text-xs' : 'text-sm'}`} style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}>
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
              className={`p-1.5 rounded-xl transition-all duration-200 ${
                showSearch
                  ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.12)]'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              title="Rechercher"
            >
              <Search className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
            </button>
            <button
              onClick={togglePinned}
              className={`p-1.5 rounded-xl transition-all duration-200 relative ${
                showPinned
                  ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.12)]'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              title="Messages épinglés"
            >
              <Pin className="w-4 h-4" />
              {chat.pinnedMessages.length > 0 && (
                <span data-numeric className="font-numeric tabular-nums absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {chat.pinnedMessages.length}
                </span>
              )}
            </button>
            {isMobile ? (
              <button
                onClick={toggleMobileMembers}
                className={`p-1.5 rounded-xl transition-all duration-200 ${
                  showMobileMembers
                    ? 'text-primary bg-primary/10 border border-primary/20'
                    : 'text-muted-foreground hover:bg-muted/40'
                }`}
                title="Membres"
              >
                <Users className="w-4 h-4" />
              </button>
            ) : (
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
        <div className="flex-1 flex min-h-0 relative">
          {/* Main message column */}
          <div className={`flex-1 flex flex-col min-w-0 ${isMobile ? 'pb-14' : ''}`}>
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

          {/* ── Mobile overlay panels ── */}
          {isMobile && (
            <AnimatePresence>
              {/* Thread panel - mobile fullscreen */}
              {chat.threadParent && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-0 z-30 bg-background"
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

              {/* Search panel - mobile fullscreen */}
              {showSearch && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-0 z-30 bg-background"
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

              {/* Pinned panel - mobile fullscreen */}
              {showPinned && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-0 z-30 bg-background"
                >
                  <PinnedMessagesPanel
                    messages={chat.pinnedMessages}
                    memberProfiles={chat.memberProfiles}
                    onUnpin={chat.togglePin}
                    onClose={() => setShowPinned(false)}
                  />
                </motion.div>
              )}

              {/* Members panel - mobile fullscreen */}
              {showMobileMembers && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                  className="absolute inset-0 z-30 bg-background"
                >
                  <div className="h-12 flex items-center gap-2 px-3 border-b border-border/20 bg-card/25 backdrop-blur-2xl">
                    <button onClick={() => setShowMobileMembers(false)} className="p-1.5 rounded-xl hover:bg-muted/50 transition-all">
                      <ArrowLeft className="w-5 h-5 text-muted-foreground" />
                    </button>
                    <h3 className="text-sm font-semibold text-foreground">Membres</h3>
                  </div>
                  <MembersPanel
                    memberProfiles={chat.memberProfiles}
                    onlineTeamMemberIds={onlineMembers}
                    onDmCreated={(channelId) => {
                      chat.setActiveChannelId(channelId);
                      chat.loadChannels();
                      setShowMobileMembers(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {/* ── Desktop side panels ── */}
          {!isMobile && (
            <>
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
                {showMembers && !chat.threadParent && !showSearch && !showPinned && (
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
            </>
          )}
        </div>
      </div>

      {isMobile && <MobileBottomNav />}
    </div>
  );
}
