import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Pencil, Check, X } from 'lucide-react';
import { Priority, PRIORITY_LABELS } from '@/types';
import { toast } from 'sonner';
import VoiceTaskCreator from './VoiceTaskCreator';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { spaces, projects, getListsForProject, teamMembers, addTask } = useApp();
  const { teamMemberId } = useAuth();

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

  const handleSubmit = () => {
    if (!title.trim()) { toast.error('Le titre est requis'); return; }
    if (!projectId) { toast.error('Sélectionnez un projet'); return; }
    const lists = getListsForProject(projectId);
    const listId = lists[0]?.id;
    if (!listId) { toast.error('Aucune liste dans ce projet'); return; }

    addTask({
      title: title.trim(),
      description,
      status: 'todo',
      priority,
      dueDate: combineDateTime(dueDate, dueTime),
      startDate: combineDateTime(startDate, startTime),
      assigneeIds,
      tags: [],
      parentTaskId: null,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    toast.success(`Tâche créée : "${title.trim()}"`);
    onOpenChange(false);
  };

  if (mode === 'voice') {
    return open ? <VoiceTaskCreator onClose={() => onOpenChange(false)} /> : null;
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
