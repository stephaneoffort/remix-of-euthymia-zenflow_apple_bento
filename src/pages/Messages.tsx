import React, { useState } from 'react';
import { useMessages, AppMessage } from '@/hooks/useMessages';
import { useApp } from '@/context/AppContext';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, CheckCheck, Mail, ArrowLeft, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

const TYPE_LABELS: Record<string, string> = {
  comment: 'Commentaire',
  chat: 'Chat',
  google_chat: 'Google Chat',
};

function MessageCard({ message, onClick }: { message: AppMessage; onClick: () => void }) {
  const { getMemberById } = useApp();
  const member = message.type !== 'google_chat' ? getMemberById(message.authorId) : null;
  const preview = stripHtml(message.content);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-colors hover:bg-muted/50 ${
        !message.isRead ? 'bg-primary/5 border-primary/20' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
            message.type === 'google_chat' ? 'bg-emerald-600' : ''
          }`}
          style={message.type !== 'google_chat' ? { backgroundColor: member?.avatarColor || '#888' } : undefined}
        >
          {message.type === 'google_chat' ? 'G' : (member?.name || 'M').charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-foreground">{message.authorName}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true, locale: fr })}
              </span>
              {!message.isRead && (
                <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 ${
                message.type === 'google_chat' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''
              }`}
            >
              {TYPE_LABELS[message.type] || 'Message'}
            </Badge>
            {message.entityTitle && (
              <span className="text-xs text-muted-foreground truncate">
                {message.type === 'google_chat' ? '' : 'sur : '}{message.entityTitle}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{preview}</p>

          {message.type === 'google_chat' && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <ExternalLink className="w-3 h-3" />
              Ouvrir dans Google Chat
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Messages() {
  const { messages, unreadCount, loading, markAsRead, markAllAsRead } = useMessages();
  const navigate = useNavigate();
  const { setSelectedTaskId } = useApp();
  const [tab, setTab] = useState('all');

  const filtered = tab === 'all' ? messages : messages.filter(m => m.type === tab);

  const handleClick = (msg: AppMessage) => {
    if (!msg.isRead) markAsRead(msg.id, msg.type);
    if (msg.type === 'comment' && msg.entityId) {
      setSelectedTaskId(msg.entityId);
      navigate('/');
    } else if (msg.type === 'google_chat') {
      window.open('https://chat.google.com', '_blank');
    } else {
      navigate('/chat');
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-6 max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Messages</h1>
              <p className="text-sm text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} message${unreadCount > 1 ? 's' : ''} non lu${unreadCount > 1 ? 's' : ''}` : 'Aucun message non lu'}
              </p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="gap-1.5">
                <CheckCheck className="w-4 h-4" />
                Tout marquer comme lu
              </Button>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={setTab} className="mt-4">
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="comment">Commentaires</TabsTrigger>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="google_chat" className="gap-1">
                Google Chat
                {messages.filter(m => m.type === 'google_chat' && !m.isRead).length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">
                    {messages.filter(m => m.type === 'google_chat' && !m.isRead).length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={tab} className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Mail className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium text-foreground">Aucun message pour toi</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Les @mentions et commentaires qui te sont adressés apparaîtront ici
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(msg => (
                    <MessageCard key={msg.id} message={msg} onClick={() => handleClick(msg)} />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </SidebarProvider>
  );
}
