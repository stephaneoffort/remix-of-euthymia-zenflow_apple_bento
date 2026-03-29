import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import DriveAttachments from '@/components/drive/DriveAttachments';
import CanvaAttachments from '@/components/canva/CanvaAttachments';
import type { CalendarEvent } from '@/hooks/useCalendarSync';

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
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

export default function CalendarEventDialog({ open, onClose, onSave, onDelete, event, defaultDate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      if (event) {
        setTitle(event.title);
        setDescription(event.description || '');
        setLocation(event.location || '');
        setIsAllDay(event.is_all_day);
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
      await onSave({
        title: title.trim(),
        description: description.trim(),
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        is_all_day: isAllDay,
        location: location.trim(),
      });
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
          {event && (
            <>
              <DriveAttachments entityType="event" entityId={event.id} compact />
              <CanvaAttachments entityType="event" entityId={event.id} compact defaultTitle={event.title} />
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
