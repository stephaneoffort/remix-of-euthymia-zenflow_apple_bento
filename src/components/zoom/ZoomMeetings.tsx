import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Plus, ExternalLink, Copy, Trash2, Play, Link } from 'lucide-react';
import { useZoom, type ZoomMeeting } from '@/hooks/useZoom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';

interface Props {
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  compact?: boolean;
  defaultTitle?: string;
}

export default function ZoomMeetings({ entityType, entityId, compact, defaultTitle }: Props) {
  const { isActive } = useIntegrations();
  const zoom = useZoom();
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const fetchMeetings = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const data = await zoom.listMeetings(entityType, entityId);
      setMeetings(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  if (!isActive('zoom')) return null;

  const handleDelete = async (m: ZoomMeeting) => {
    if (!confirm('Supprimer cette réunion Zoom ?')) return;
    try {
      await zoom.deleteMeeting(m.id, m.zoom_meeting_id);
      setMeetings(prev => prev.filter(x => x.id !== m.id));
      toast.success('Réunion supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Lien copié !');
  };

  if (!zoom.isConnected && meetings.length === 0 && !loading) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.zoom.icon} alt="Zoom" className="w-5 h-5" /> Zoom
        </p>
        <Button variant="outline" size="sm" onClick={zoom.connect} className="gap-1.5 text-xs">
          <img src={INTEGRATION_CONFIG.zoom.icon} alt="" className="w-4 h-4" /> Connecter Zoom
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <img src={INTEGRATION_CONFIG.zoom.icon} alt="Zoom" className="w-5 h-5" /> Zoom
        </p>
        {zoom.isConnected && (
          <Button variant="ghost" size="sm" onClick={() => setCreatorOpen(true)} className="h-6 px-2 text-xs gap-1">
            <Plus className="w-3 h-3" /> Réunion
          </Button>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-10 w-full rounded-md" />
      ) : meetings.length === 0 ? (
        zoom.isConnected ? (
          <button
            onClick={() => setCreatorOpen(true)}
            className="w-full py-3 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            + Créer une réunion Zoom
          </button>
        ) : null
      ) : (
        <div className="space-y-1.5">
          {meetings.map(m => (
            <div key={m.id} className="group flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 rounded bg-blue-500/10 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{m.topic}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  {m.start_time && (
                    <span>{format(new Date(m.start_time), "dd MMM yyyy · HH:mm", { locale: fr })}</span>
                  )}
                  {m.duration && <span>· {m.duration} min</span>}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => window.open(m.join_url, '_blank')} className="p-1 rounded hover:bg-muted" title="Rejoindre">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => copyLink(m.join_url)} className="p-1 rounded hover:bg-muted" title="Copier le lien">
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => window.open(m.start_url, '_blank')} className="p-1 rounded hover:bg-muted" title="Démarrer (hôte)">
                  <Play className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => handleDelete(m)} className="p-1 rounded hover:bg-muted" title="Supprimer">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ZoomMeetingCreator
        open={creatorOpen}
        onOpenChange={setCreatorOpen}
        entityType={entityType}
        entityId={entityId}
        defaultTitle={defaultTitle}
        onCreated={fetchMeetings}
      />
    </div>
  );
}

// ── Creator Dialog ──
function ZoomMeetingCreator({
  open, onOpenChange, entityType, entityId, defaultTitle, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: string;
  entityId: string;
  defaultTitle?: string;
  onCreated: () => void;
}) {
  const zoom = useZoom();
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setTopic(defaultTitle ?? '');
      const now = new Date();
      setDate(now.toISOString().slice(0, 10));
      setTime('10:00');
      setDuration('60');
      setCreating(false);
    }
  }, [open, defaultTitle]);

  const handleCreate = async (instant = false) => {
    if (!topic.trim()) return;
    setCreating(true);
    try {
      const startTime = instant ? undefined : `${date}T${time}:00`;
      await zoom.createMeeting(topic.trim(), entityType, entityId, startTime, parseInt(duration));
      toast.success('Réunion Zoom créée ✅');
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  if (!zoom.isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" /> Zoom
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">Connecte ton compte Zoom pour créer des réunions.</p>
            <Button onClick={zoom.connect} className="gap-2">
              <Video className="w-4 h-4" /> Connecter Zoom
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-blue-600" /> Nouvelle réunion Zoom
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Sujet</Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Réunion d'équipe…" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Heure</Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Durée</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
                <SelectItem value="90">1h30</SelectItem>
                <SelectItem value="120">2 heures</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => handleCreate(true)} variant="outline" disabled={creating || !topic.trim()} className="flex-1 gap-1.5">
              <Play className="w-3.5 h-3.5" /> Instantanée
            </Button>
            <Button onClick={() => handleCreate(false)} disabled={creating || !topic.trim()} className="flex-1 gap-1.5">
              <Video className="w-3.5 h-3.5" /> Planifier
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
