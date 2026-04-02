import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Link2, Bell, Mail, MessageSquare, Check, Copy, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ShareTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

export default function ShareTaskDialog({ open, onOpenChange, taskId }: ShareTaskDialogProps) {
  const { getTaskById, teamMembers, getMemberById, updateTask } = useApp();
  const { teamMemberId } = useAuth();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const task = getTaskById(taskId);
  if (!task) return null;

  const currentMember = teamMemberId ? getMemberById(teamMemberId) : null;
  const otherMembers = teamMembers.filter(m => m.id !== teamMemberId);

  const taskUrl = `${window.location.origin}/?task=${taskId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(taskUrl);
      setLinkCopied(true);
      toast({ title: 'Lien copié', description: 'Le lien de la tâche a été copié dans le presse-papier.' });
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de copier le lien.', variant: 'destructive' });
    }
  };

  const handleSendNotification = async () => {
    if (!selectedMemberId || !currentMember) return;
    setSending(true);
    try {
      // Find or create a DM channel with this member
      const targetMember = getMemberById(selectedMemberId);
      if (!targetMember) throw new Error('Membre introuvable');

      const message = shareMessage.trim()
        ? `📋 **Tâche partagée** : [${task.title}](${taskUrl})\n\n${shareMessage}`
        : `📋 **Tâche partagée** : [${task.title}](${taskUrl})`;

      // Try to find existing DM channel
      const { data: existingChannels } = await supabase
        .from('chat_channels')
        .select('id')
        .eq('type', 'dm');

      let dmChannelId: string | null = null;

      if (existingChannels) {
        for (const ch of existingChannels) {
          const { data: members } = await supabase
            .from('chat_channel_members')
            .select('user_id')
            .eq('channel_id', ch.id);
          if (members && members.length === 2) {
            const userIds = members.map(m => m.user_id);
            // Check if both users are in this channel - we need user_ids not team_member_ids
            // For now, send via a general notification approach
          }
        }
      }

      // Use edge function to send notification
      const { error } = await supabase.functions.invoke('share-task', {
        body: {
          taskId: task.id,
          taskTitle: task.title,
          taskUrl,
          targetMemberEmail: targetMember.email,
          targetMemberName: targetMember.name,
          senderName: currentMember.name,
          message: shareMessage.trim() || null,
          method: 'notification',
        },
      });

      if (error) throw error;

      toast({ title: 'Notification envoyée', description: `${targetMember.name} a été notifié(e).` });
      setShareMessage('');
      setSelectedMemberId(null);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible d\'envoyer la notification.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleShareByEmail = async () => {
    if (!selectedMemberId || !currentMember) return;
    setSending(true);
    try {
      const targetMember = getMemberById(selectedMemberId);
      if (!targetMember) throw new Error('Membre introuvable');

      const { error } = await supabase.functions.invoke('share-task', {
        body: {
          taskId: task.id,
          taskTitle: task.title,
          taskUrl,
          targetMemberEmail: targetMember.email,
          targetMemberName: targetMember.name,
          senderName: currentMember.name,
          message: shareMessage.trim() || null,
          method: 'email',
        },
      });

      if (error) throw error;

      toast({ title: 'Email envoyé', description: `Un email a été envoyé à ${targetMember.name}.` });
      setShareMessage('');
      setSelectedMemberId(null);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible d\'envoyer l\'email.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleMentionInComment = () => {
    if (!selectedMemberId) return;
    const targetMember = getMemberById(selectedMemberId);
    if (!targetMember) return;

    const mentionContent = `@${targetMember.name} — tâche partagée${shareMessage.trim() ? `: ${shareMessage}` : ''}`;
    
    updateTask(task.id, {
      comments: [...task.comments, {
        id: `c_${Date.now()}`,
        authorId: teamMemberId || 'tm1',
        content: mentionContent,
        createdAt: new Date().toISOString(),
      }],
    });

    toast({ title: 'Commentaire ajouté', description: `@${targetMember.name} a été mentionné(e) dans les commentaires.` });
    setShareMessage('');
    setSelectedMemberId(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Partager la tâche</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground truncate mb-3">
          {task.title}
        </p>

        {/* Copy link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            {linkCopied ? <Check className="w-4 h-4 text-primary" /> : <Link2 className="w-4 h-4 text-primary" />}
          </div>
          <div>
            <div className="text-sm font-medium">{linkCopied ? 'Lien copié !' : 'Copier le lien'}</div>
            <div className="text-xs text-muted-foreground">Partager via chat ou messagerie</div>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-2 my-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">Partager avec un membre</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Member selector */}
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
          {otherMembers.map(member => (
            <button
              key={member.id}
              onClick={() => setSelectedMemberId(member.id === selectedMemberId ? null : member.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedMemberId === member.id
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-muted hover:bg-accent text-foreground'
              )}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              {member.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Message (optional) */}
        {selectedMemberId && (
          <textarea
            value={shareMessage}
            onChange={e => setShareMessage(e.target.value)}
            placeholder="Ajouter un message (optionnel)..."
            className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-none"
            rows={2}
          />
        )}

        {/* Action buttons */}
        {selectedMemberId && (
          <div className="flex flex-col gap-2">
            <Button
              size="sm"
              onClick={handleSendNotification}
              disabled={sending}
              className="w-full justify-start gap-2"
            >
              <Bell className="w-4 h-4" />
              Envoyer une notification
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleShareByEmail}
              disabled={sending}
              className="w-full justify-start gap-2"
            >
              <Mail className="w-4 h-4" />
              Partager par email
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMentionInComment}
              disabled={sending}
              className="w-full justify-start gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Mentionner dans un commentaire
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
