import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Link2, Bell, Mail, MessageSquare, Check, Clock, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ShareTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
}

interface ShareRecord {
  id: string;
  sender_member_id: string;
  target_member_id: string | null;
  method: string;
  message: string | null;
  created_at: string;
}

const METHOD_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  link: { icon: <Link2 className="w-3 h-3" />, label: 'Lien copié' },
  notification: { icon: <Bell className="w-3 h-3" />, label: 'Notification' },
  email: { icon: <Mail className="w-3 h-3" />, label: 'Email' },
  comment: { icon: <MessageSquare className="w-3 h-3" />, label: 'Commentaire' },
};

export default function ShareTaskDialog({ open, onOpenChange, taskId }: ShareTaskDialogProps) {
  const { getTaskById, teamMembers, getMemberById, updateTask } = useApp();
  const { teamMemberId } = useAuth();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareHistory, setShareHistory] = useState<ShareRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const task = getTaskById(taskId);
  const currentMember = teamMemberId ? getMemberById(teamMemberId) : null;
  const otherMembers = teamMembers.filter(m => m.id !== teamMemberId);
  const taskUrl = `${window.location.origin}/?task=${taskId}`;

  useEffect(() => {
    if (open && taskId) {
      supabase
        .from('task_shares')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setShareHistory(data as ShareRecord[]);
        });
    }
  }, [open, taskId]);

  if (!task) return null;

  const recordShare = async (method: string, targetId: string | null) => {
    const { data } = await supabase.from('task_shares').insert({
      task_id: taskId,
      sender_member_id: teamMemberId || 'unknown',
      target_member_id: targetId,
      method,
      message: shareMessage.trim() || null,
    }).select().single();
    if (data) setShareHistory(prev => [data as ShareRecord, ...prev]);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(taskUrl);
      setLinkCopied(true);
      await recordShare('link', null);
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
      const targetMember = getMemberById(selectedMemberId);
      if (!targetMember) throw new Error('Membre introuvable');

      const { error } = await supabase.functions.invoke('share-task', {
        body: {
          taskId: task.id, taskTitle: task.title, taskUrl,
          targetMemberEmail: targetMember.email, targetMemberName: targetMember.name,
          senderName: currentMember.name, message: shareMessage.trim() || null, method: 'notification',
        },
      });
      if (error) throw error;

      await recordShare('notification', selectedMemberId);
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
          taskId: task.id, taskTitle: task.title, taskUrl,
          targetMemberEmail: targetMember.email, targetMemberName: targetMember.name,
          senderName: currentMember.name, message: shareMessage.trim() || null, method: 'email',
        },
      });
      if (error) throw error;

      await recordShare('email', selectedMemberId);
      toast({ title: 'Email envoyé', description: `Un email a été envoyé à ${targetMember.name}.` });
      setShareMessage('');
      setSelectedMemberId(null);
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Impossible d\'envoyer l\'email.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleMentionInComment = async () => {
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

    await recordShare('comment', selectedMemberId);
    toast({ title: 'Commentaire ajouté', description: `@${targetMember.name} a été mentionné(e) dans les commentaires.` });
    setShareMessage('');
    setSelectedMemberId(null);
    onOpenChange(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Partager la tâche</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground truncate mb-3">{task.title}</p>

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
            <Button size="sm" onClick={handleSendNotification} disabled={sending} className="w-full justify-start gap-2">
              <Bell className="w-4 h-4" /> Envoyer une notification
            </Button>
            <Button size="sm" variant="outline" onClick={handleShareByEmail} disabled={sending} className="w-full justify-start gap-2">
              <Mail className="w-4 h-4" /> Partager par email
            </Button>
            <Button size="sm" variant="ghost" onClick={handleMentionInComment} disabled={sending} className="w-full justify-start gap-2">
              <MessageSquare className="w-4 h-4" /> Mentionner dans un commentaire
            </Button>
          </div>
        )}

        {/* Share history */}
        {shareHistory.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-px bg-border" />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Clock className="w-3 h-3" />
                Historique ({shareHistory.length})
              </button>
              <div className="flex-1 h-px bg-border" />
            </div>

            {showHistory && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {shareHistory.map(share => {
                  const sender = getMemberById(share.sender_member_id);
                  const target = share.target_member_id ? getMemberById(share.target_member_id) : null;
                  const methodInfo = METHOD_LABELS[share.method] || { icon: <Share2 className="w-3 h-3" />, label: share.method };

                  return (
                    <div key={share.id} className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-muted/30 text-xs">
                      <div className="mt-0.5 text-muted-foreground shrink-0">{methodInfo.icon}</div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-foreground">{sender?.name || 'Inconnu'}</span>
                        {target && (
                          <span className="text-muted-foreground"> → {target.name}</span>
                        )}
                        <span className="text-muted-foreground"> · {methodInfo.label}</span>
                        {share.message && (
                          <p className="text-muted-foreground italic truncate mt-0.5">"{share.message}"</p>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0 whitespace-nowrap">{formatDate(share.created_at)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
