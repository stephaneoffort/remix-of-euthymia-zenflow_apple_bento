import React, { useState } from 'react';
import { useMessages, AppMessage } from '@/hooks/useMessages';
import { useApp } from '@/context/AppContext';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, CheckCheck, Mail, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function MessageCard({ message, onClick }: { message: AppMessage; onClick: () => void }) {
  const { getMemberById } = useApp();
  const member = getMemberById(message.authorId);
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
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: member?.avatarColor || '#888' }}
        >
          {(member?.name || 'M').charAt(0).toUpperCase()}
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
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {message.type === 'comment' ? 'Commentaire' : 'Chat'}
            </Badge>
            {message.entityTitle && (
              <span className="text-xs text-muted-foreground truncate">
                sur : {message.entityTitle}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{preview}</p>
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
    if (!msg.isRead) markAsRead(msg.id);
    if (msg.type === 'comment' && msg.entityId) {
      setSelectedTaskId(msg.entityId);
      navigate('/');
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
