import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Video, Copy, ExternalLink } from 'lucide-react';
import DriveAttachments from '@/components/drive/DriveAttachments';
import CanvaAttachments from '@/components/canva/CanvaAttachments';
import ZoomMeetings from '@/components/zoom/ZoomMeetings';
import BrevoContacts from '@/components/brevo/BrevoContacts';
import GoogleCalendarPicker from '@/components/GoogleCalendarPicker';
import type { CalendarEvent } from '@/hooks/useCalendarSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';
import { useZoom } from '@/hooks/useZoom';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    is_all_day: boolean;
    location: string;
    has_meet?: boolean;
    target_calendar_id?: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

export default function CalendarEventDialog({ open, onClose, onSave, onDelete, event, defaultDate }: Props) {
  const { isActive } = useIntegrations();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [hasMeet, setHasMeet] = useState(false);
  const [hasZoom, setHasZoom] = useState(false);
  const [creatingZoom, setCreatingZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [targetCalendarId, setTargetCalendarId] = useState<string | null>(null);
  const zoom = useZoom();

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description || '');
        setLocation(event.location || '');
        setIsAllDay(event.is_all_day);
        setHasMeet(event.has_meet ?? false);
        const s = new Date(event.start_time);
        const e = new Date(event.end_time);
        setStartDate(s.toISOString().slice(0, 10));
        setStartTime(s.toTimeString().slice(0, 5));
        setEndDate(e.toISOString().slice(0, 10));
        setEndTime(e.toTimeString().slice(0, 5));
      } else {
        const d = defaultDate || new Date().toISOString().slice(0, 10);
        setTitle('');
        setDescription('');
        setLocation('');
        setIsAllDay(false);
        setHasMeet(false);
        setHasZoom(false);
        setTargetCalendarId(null);
        setStartDate(d);
        setStartTime('09:00');
        setEndDate(d);
        setEndTime('10:00');
      }
      setSaving(false);
      setDeleting(false);
    }
  }, [open, event, defaultDate]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const start = isAllDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}:00`;
      const end = isAllDay ? `${endDate || startDate}T23:59:59` : `${endDate || startDate}T${endTime}:00`;
      const startISO = new Date(start).toISOString();
      const endISO = new Date(end).toISOString();

      // Save the event (creates in DB + pushes to Google Calendar)
      await onSave({
        title: title.trim(),
        description: description.trim(),
        start_time: startISO,
        end_time: endISO,
        is_all_day: isAllDay,
        location: location.trim(),
        has_meet: hasMeet,
        target_calendar_id: targetCalendarId,
      });

      // If Zoom is toggled, create Zoom meeting and re-sync to Google Calendar
      if (hasZoom && zoom.isConnected && !event) {
        try {
          const durationMin = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);

          // Find the just-created event by title+start_time
          const { data: createdEvents } = await supabase
            .from('calendar_events')
            .select('id, account_id, description')
            .eq('title', title.trim())
            .eq('start_time', startISO)
            .order('created_at', { ascending: false })
            .limit(1);

          const createdEvent = createdEvents?.[0];
          const eventId = (createdEvent as any)?.id || '';

          // Create Zoom meeting linked to this event
          const zoomResult = await zoom.createMeeting(
            title.trim(),
            'event',
            eventId,
            isAllDay ? undefined : startISO,
            durationMin > 0 ? durationMin : 60
          );

          console.log('Zoom meeting created:', zoomResult);

          // Update calendar event with Zoom link in description
          if (zoomResult?.join_url && eventId) {
            const zoomSection = [
              '',
              '── Session Zoom ──',
              `Rejoindre : ${zoomResult.join_url}`,
              zoomResult.password ? `Mot de passe : ${zoomResult.password}` : '',
            ].filter(Boolean).join('\n');

            const newDescription = ((createdEvent as any)?.description || description.trim() || '') + zoomSection;

            await supabase
              .from('calendar_events')
              .update({
                description: newDescription,
                meet_link: zoomResult.join_url,
                sync_status: 'pending',
              } as any)
              .eq('id', eventId);

            // Re-push to Google Calendar with updated Zoom link
            const accountId = (createdEvent as any)?.account_id;
            if (accountId) {
              try {
                const { data: { session } } = await supabase.auth.getSession();
                const CALENDAR_SYNC_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/calendar-sync`;
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (session?.access_token) {
                  headers['Authorization'] = `Bearer ${session.access_token}`;
                }
                await fetch(CALENDAR_SYNC_URL, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                    account_id: accountId,
                    direction: 'push',
                    event_id: eventId,
                    action: 'update',
                  }),
                });
                console.log('Re-pushed event to Google Calendar with Zoom link');
              } catch (pushErr) {
                console.error('Failed to re-push event with Zoom link:', pushErr);
              }
            }
          }

          toast.success('Réunion Zoom créée ✅');
        } catch (zoomErr) {
          console.error('Zoom creation error:', zoomErr);
          toast.error('Événement créé, mais erreur Zoom');
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const copyMeetLink = () => {
    if (event?.meet_link) {
      navigator.clipboard.writeText(event.meet_link);
      toast.success('Lien Meet copié ✅');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Modifier l\'événement' : 'Nouvel événement'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="ev-title">Titre</Label>
            <Input id="ev-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Réunion, RDV…" autoFocus />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="ev-allday" checked={isAllDay} onCheckedChange={setIsAllDay} />
            <Label htmlFor="ev-allday" className="text-sm">Journée entière</Label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Début</Label>
              <Input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }} />
              {!isAllDay && <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1" />}
            </div>
            <div>
              <Label>Fin</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              {!isAllDay && <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1" />}
            </div>
          </div>
          <div>
            <Label htmlFor="ev-location">Lieu (optionnel)</Label>
            <Input id="ev-location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Bureau, visio…" />
          </div>
          <div>
            <Label htmlFor="ev-desc">Description (optionnel)</Label>
            <Textarea id="ev-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>

          {!event && (
            <GoogleCalendarPicker
              value={targetCalendarId}
              onChange={setTargetCalendarId}
            />
          )}

          {isActive('google_meet') && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
              <Video className="w-4 h-4 text-[hsl(174,60%,30%)] shrink-0" />
              <div className="flex-1">
                <Label htmlFor="ev-meet" className="text-sm font-medium cursor-pointer">Google Meet</Label>
                {hasMeet && !event?.meet_link && (
                  <p className="text-[10px] text-muted-foreground">Un lien Meet sera généré automatiquement</p>
                )}
              </div>
              <Switch id="ev-meet" checked={hasMeet} onCheckedChange={setHasMeet} />
            </div>
          )}

          {isActive('zoom') && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20">
              <img src={INTEGRATION_CONFIG.zoom.icon} alt="Zoom" className="w-4 h-4 shrink-0" />
              <div className="flex-1">
                <Label htmlFor="ev-zoom" className="text-sm font-medium cursor-pointer">Zoom</Label>
                {hasZoom && !zoom.isConnected && (
                  <p className="text-[10px] text-destructive">Connectez Zoom dans les paramètres</p>
                )}
                {hasZoom && zoom.isConnected && (
                  <p className="text-[10px] text-muted-foreground">Une réunion Zoom sera créée automatiquement</p>
                )}
              </div>
              <Switch id="ev-zoom" checked={hasZoom} onCheckedChange={setHasZoom} />
            </div>
          )}

          {event?.meet_link && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[hsl(174,60%,30%)]/10 border border-[hsl(174,60%,30%)]/20">
              <Video className="w-4 h-4 text-[hsl(174,60%,30%)] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">Google Meet actif</p>
                <p className="text-[10px] text-muted-foreground truncate">{event.meet_link.replace('https://', '')}</p>
              </div>
              <button onClick={() => window.open(event.meet_link!, '_blank')} className="p-1 rounded hover:bg-muted" title="Rejoindre">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={copyMeetLink} className="p-1 rounded hover:bg-muted" title="Copier le lien">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          )}

          {event && (
            <>
              <DriveAttachments entityType="event" entityId={event.id} compact />
              <CanvaAttachments entityType="event" entityId={event.id} compact defaultTitle={event.title} />
              <ZoomMeetings entityType="event" entityId={event.id} compact defaultTitle={event.title} />
              <BrevoContacts entityType="event" entityId={event.id} compact />
            </>
          )}
          <div className="flex items-center justify-between pt-2">
            {event && onDelete ? (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Supprimer
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving || !title.trim()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                {event ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
