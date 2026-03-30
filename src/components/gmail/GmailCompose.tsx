import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mail, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';
import { toast } from 'sonner';

interface GmailComposeProps {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  defaultSubject?: string;
  compact?: boolean;
}

export default function GmailCompose({ entityType, entityId, defaultSubject, compact }: GmailComposeProps) {
  const { isActive } = useIntegrations();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  if (!isActive('gmail')) return null;

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error('Remplis tous les champs');
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const res = await supabase.functions.invoke('gmail-send', {
        body: { to: to.trim(), subject: subject.trim(), body: body.trim() },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success('Email envoyé !');
      setTo('');
      setBody('');
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full ${compact ? 'text-xs' : 'text-sm'}`}
      >
        <span className="font-medium text-foreground flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.gmail.icon} alt="Gmail" className="w-5 h-5" />
          Envoyer un email
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
          <Input
            placeholder="Destinataire (email)"
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="text-sm h-8"
          />
          <Input
            placeholder="Objet"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="text-sm h-8"
          />
          <Textarea
            placeholder="Votre message..."
            value={body}
            onChange={e => setBody(e.target.value)}
            className="text-sm min-h-[80px] resize-none"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
              className="gap-1.5 text-xs"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Envoi...' : 'Envoyer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
