import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Pencil, Check, X, Bell, Plus } from 'lucide-react';
import { Priority, PRIORITY_LABELS } from '@/types';
import { toast } from 'sonner';
import VoiceTaskCreator from './VoiceTaskCreator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { formatReminderOffset } from '@/lib/reminderFormat';


type ReminderDraft = { amount: number; unit: 'min' | 'h' | 'd'; type: 'before_start' | 'before_end' };
const UNIT_LABEL: Record<ReminderDraft['unit'], string> = { min: 'min', h: 'h', d: 'j' };

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { spaces, projects, getListsForProject, teamMembers, addTask } = useApp();
  const { teamMemberId } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'choice' | 'form' | 'voice'>('choice');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [remAmount, setRemAmount] = useState(1);
  const [remUnit, setRemUnit] = useState<ReminderDraft['unit']>('h');
  const [remType, setRemType] = useState<ReminderDraft['type']>('before_end');

  const visibleSpaces = useMemo(() => spaces.filter(s => !s.isArchived), [spaces]);
  const spaceProjects = useMemo(
    () => projects.filter(p => p.spaceId === spaceId && !p.isArchived),
    [projects, spaceId]
  );

  useEffect(() => {
    if (open) {
      setMode('choice');
      setTitle(''); setDescription('');
      setSpaceId(''); setProjectId('');
      setPriority('normal');
      setStartDate(''); setStartTime(''); setDueDate(''); setDueTime('');
      setAssigneeIds(teamMemberId ? [teamMemberId] : []);
      setReminders([]); setRemAmount(1); setRemUnit('h'); setRemType('before_end');
    }
  }, [open, teamMemberId]);

  useEffect(() => { setProjectId(''); }, [spaceId]);

  const toggleAssignee = (id: string) => {
    setAssigneeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const combineDateTime = (d: string, t: string): string | null => {
    if (!d) return null;
    return t ? `${d}T${t}:00` : d;
  };

  const addReminderDraft = () => {
    const amount = Math.max(1, Math.floor(remAmount) || 1);
    if (reminders.find(r => r.amount === amount && r.unit === remUnit && r.type === remType)) {
      toast.error('Ce rappel existe déjà');
      return;
    }
    setReminders(prev => [...prev, { amount, unit: remUnit, type: remType }]);
  };

  const removeReminderDraft = (i: number) => setReminders(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Le titre est requis'); return; }
    if (!projectId) { toast.error('Sélectionnez un projet'); return; }
    const lists = getListsForProject(projectId);
    const listId = lists[0]?.id;
    if (!listId) { toast.error('Aucune liste dans ce projet'); return; }

    const startISO = combineDateTime(startDate, startTime);
    const dueISO = combineDateTime(dueDate, dueTime);

    // Warn about reminders needing dates
    const missingStart = reminders.some(r => r.type === 'before_start') && !startISO;
    const missingEnd = reminders.some(r => r.type === 'before_end') && !dueISO;
    if (missingStart || missingEnd) {
      toast.error('Certains rappels nécessitent une date de début ou d\'échéance');
      return;
    }

    if (reminders.length === 0) {
      addTask({
        title: title.trim(), description, status: 'todo', priority,
        dueDate: dueISO, startDate: startISO, assigneeIds,
        tags: [], parentTaskId: null, listId,
        comments: [], attachments: [],
        timeEstimate: null, timeLogged: null, aiSummary: null,
      });
      toast.success(`Tâche créée : "${title.trim()}"`);
      onOpenChange(false);
      return;
    }

    // With reminders: insert directly to get id
    try {
      const { data, error } = await supabase.from('tasks').insert({
        title: title.trim(), description, status: 'todo', priority,
        due_date: dueISO, start_date: startISO,
        parent_task_id: null, list_id: listId,
        tags: [], time_estimate: null, time_logged: null, ai_summary: null,
      }).select().single();
      if (error) throw error;

      if (assigneeIds.length > 0) {
        await supabase.from('task_assignees').insert(
          assigneeIds.map(mid => ({ task_id: data.id, member_id: mid }))
        );
      }

      await (supabase as any).from('task_reminders').insert(
        reminders.map(r => ({
          task_id: data.id,
          reminder_type: r.type,
          offset_key: `${r.amount}${r.unit}`,
        }))
      );

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(`Tâche créée : "${title.trim()}"`);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error('Erreur lors de la création de la tâche');
    }
  };

  if (mode === 'voice') {
    return open ? (
      <VoiceTaskCreator
        onClose={() => onOpenChange(false)}
        onParsed={(parsed) => {
          // Prefill form fields with parsed voice data
          setTitle(parsed.title || '');
          setDescription(parsed.description || '');
          setPriority((parsed.priority as Priority) || 'normal');
          if (parsed.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) setDueDate(parsed.dueDate);
          if (parsed.dueTime && /^\d{2}:\d{2}$/.test(parsed.dueTime)) setDueTime(parsed.dueTime);
          if (parsed.startDate && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate)) setStartDate(parsed.startDate);
          // Match assignees by name (fuzzy first-name match)
          const ids = (parsed.assignees || [])
            .map((name: string) => {
              const lower = name.toLowerCase();
              return teamMembers.find(m =>
                m.name.toLowerCase().includes(lower) ||
                lower.includes(m.name.split(' ')[0].toLowerCase())
              )?.id;
            })
            .filter(Boolean) as string[];
          if (ids.length > 0) setAssigneeIds(ids);
          setMode('form');
          toast.success('Formulaire pré-rempli à partir de la dictée');
        }}
      />
    ) : null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover text-popover-foreground max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer une tâche</DialogTitle>
          <DialogDescription>
            Remplissez le formulaire ou utilisez la dictée vocale.
          </DialogDescription>
        </DialogHeader>

        {mode === 'choice' && (
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => setMode('form')}
              className="flex flex-col items-center gap-2 p-6 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Pencil className="w-8 h-8 text-primary" />
              <span className="text-sm font-medium">Par écrit</span>
              <span className="text-xs text-muted-foreground text-center">Formulaire complet</span>
            </button>
            <button
              onClick={() => setMode('voice')}
              className="flex flex-col items-center gap-2 p-6 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Mic className="w-8 h-8 text-primary" />
              <span className="text-sm font-medium">Par la voix</span>
              <span className="text-xs text-muted-foreground text-center">Dictée IA</span>
            </button>
          </div>
        )}

        {mode === 'form' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Titre *</Label>
              <Input
                id="task-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nom de la tâche"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Espace *</Label>
                <Select value={spaceId} onValueChange={setSpaceId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un espace" /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {visibleSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Projet *</Label>
                <Select value={projectId} onValueChange={setProjectId} disabled={!spaceId}>
                  <SelectTrigger><SelectValue placeholder={spaceId ? 'Choisir un projet' : 'Espace d\'abord'} /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    {spaceProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-popover">
                  {(['urgent','high','normal','low'] as Priority[]).map(p => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date de début</Label>
                <div className="flex gap-2">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-28" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Date d'échéance</Label>
                <div className="flex gap-2">
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-28" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> Rappels</Label>
              {reminders.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {reminders.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary font-medium">
                      <Bell className="w-3 h-3" />
                      {formatReminderOffset({ amount: r.amount, unit: r.unit })} avant {r.type === 'before_start' ? 'début' : 'échéance'}
                      <button type="button" onClick={() => removeReminderDraft(i)} className="ml-0.5 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={remAmount}
                  onChange={(e) => setRemAmount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-9"
                />
                <Select value={remUnit} onValueChange={(v) => setRemUnit(v as ReminderDraft['unit'])}>
                  <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="min">Minutes</SelectItem>
                    <SelectItem value="h">Heures</SelectItem>
                    <SelectItem value="d">Jours</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">avant</span>
                <Select value={remType} onValueChange={(v) => setRemType(v as ReminderDraft['type'])}>
                  <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="before_start">le début</SelectItem>
                    <SelectItem value="before_end">l'échéance</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="outline" onClick={addReminderDraft}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Détails de la tâche…"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Responsables</Label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 border border-border rounded-md">
                {teamMembers.map(m => {
                  const selected = assigneeIds.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleAssignee(m.id)}
                      className={`text-xs px-2 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                        selected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-border hover:border-foreground/30'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3" />}
                      {m.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setMode('voice')}>
                <Mic className="w-4 h-4 mr-1" /> Passer en vocal
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  <X className="w-4 h-4 mr-1" /> Annuler
                </Button>
                <Button onClick={handleSubmit}>
                  <Check className="w-4 h-4 mr-1" /> Créer
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
