import React, { useState } from 'react';
import { useMessages, AppMessage } from '@/hooks/useMessages';
import { useApp } from '@/context/AppContext';
import AppSidebar from '@/components/AppSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, CheckCheck, Mail, ArrowLeft, Reply, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import MentionCommentInput from '@/components/MentionCommentInput';

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

const TYPE_LABELS: Record<string, string> = {
  comment: 'Commentaire',
  chat: 'Chat',
};

function MessageCard({
  message,
  onClick,
  replyingTo,
  onReplyToggle,
  onReplySent,
}: {
  message: AppMessage;
  onClick: () => void;
  replyingTo: boolean;
  onReplyToggle: () => void;
  onReplySent: () => void;
}) {
  const { getMemberById } = useApp();
  const { teamMemberId } = useAuth();
  const member = getMemberById(message.authorId);
  const preview = stripHtml(message.content);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendReply = async (content: string, mentionedIds: string[]) => {
    if (!content.trim() || content === '<p></p>' || !teamMemberId) return;
    setSending(true);
    try {
      if (message.type === 'comment' && message.entityId) {
        // Reply as a comment on the same task
        await supabase.from('comments').insert({
          task_id: message.entityId,
          author_id: teamMemberId,
          content,
          mentioned_member_ids: mentionedIds.length > 0 ? mentionedIds : [message.authorId],
        });
        toast.success('Réponse envoyée');
      }
      setReplyContent('');
      onReplySent();
    } catch (e) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`rounded-lg border transition-colors ${!message.isRead ? 'bg-primary/5 border-primary/20' : 'border-border'}`}>
      <button
        onClick={onClick}
        className="w-full text-left p-4 hover:bg-muted/50 transition-colors rounded-t-lg"
      >
        <div className="flex items-start gap-3">
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
                {TYPE_LABELS[message.type] || 'Message'}
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

      {/* Reply button */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-foreground h-7"
          onClick={(e) => { e.stopPropagation(); onReplyToggle(); }}
        >
          {replyingTo ? <X className="w-3.5 h-3.5" /> : <Reply className="w-3.5 h-3.5" />}
          {replyingTo ? 'Annuler' : 'Répondre'}
        </Button>
      </div>

      {/* Inline reply area */}
      {replyingTo && (
        <div className="px-4 pb-4 border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground mb-2">
            Répondre à <span className="font-medium text-foreground">{message.authorName}</span>
            {message.entityTitle ? ` sur ${message.entityTitle}` : ''}
          </p>
          <div className="relative">
              <MentionCommentInput
                value={replyContent}
                onChange={setReplyContent}
                onSubmit={handleSendReply}
                placeholder={`Répondre à ${message.authorName}...`}
              />
              {sending && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                </div>
              )}
            </div>
        </div>
      )}
    </div>
  );
}

export default function Messages() {
  const { messages, unreadCount, loading, markAsRead, markAllAsRead, refetch } = useMessages();
  const navigate = useNavigate();
  const { setSelectedTaskId } = useApp();
  const [tab, setTab] = useState('all');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  const filtered = tab === 'all' ? messages : messages.filter(m => m.type === tab);

  const handleClick = (msg: AppMessage) => {
    if (!msg.isRead) markAsRead(msg.id, msg.type);
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
                    <MessageCard
                      key={msg.id}
                      message={msg}
                      onClick={() => handleClick(msg)}
                      replyingTo={replyingToId === msg.id}
                      onReplyToggle={() => setReplyingToId(prev => prev === msg.id ? null : msg.id)}
                      onReplySent={() => { setReplyingToId(null); refetch(); }}
                    />
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
