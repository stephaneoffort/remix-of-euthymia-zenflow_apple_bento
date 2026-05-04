import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { format, addDays, nextMonday, nextFriday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic, MicOff, Loader2, Check, X, Plus, Trash2,
  Pen, AlertCircle, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { Priority, PRIORITY_LABELS } from '@/types';

/* ─── Speech recognition ─── */
const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/* ─── Relative date resolver (same logic as VoiceTaskCreator) ─── */
function resolveDate(raw: string | null): string | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const today = new Date();
  const l = raw.toLowerCase().trim();
  if (l === "aujourd'hui" || l === 'today') return format(today, 'yyyy-MM-dd');
  if (l === 'demain' || l === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  if (l === 'après-demain' || l === 'après demain') return format(addDays(today, 2), 'yyyy-MM-dd');
  if (l.includes('lundi')) return format(nextMonday(today), 'yyyy-MM-dd');
  if (l.includes('vendredi')) return format(nextFriday(today), 'yyyy-MM-dd');
  if (l.includes('semaine prochaine')) return format(addDays(today, 7), 'yyyy-MM-dd');
  if (l.includes('dans 2 semaines') || l.includes('dans deux semaines')) return format(addDays(today, 14), 'yyyy-MM-dd');
  if (l.includes('fin du mois')) {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return format(last, 'yyyy-MM-dd');
  }
  try {
    const d = parseISO(raw);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  } catch {}
  return raw;
}

/* ─── Voice parsing API ─── */
const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-parse-task`;

async function parseVoice(transcript: string) {
  const today = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr });
  const resp = await fetch(PARSE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ transcript, today }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors du parsing IA');
  }
  const { task } = await resp.json();
  return task;
}

/* ─── Priority config ─── */
const PRIORITY_CONFIG: { value: Priority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgente', color: 'text-red-500' },
  { value: 'high', label: 'Haute', color: 'text-orange-500' },
  { value: 'normal', label: 'Normale', color: 'text-blue-500' },
  { value: 'low', label: 'Basse', color: 'text-slate-400' },
];

/* ─── Props ─── */
interface Props {
  open: boolean;
  onClose: () => void;
}

export default function QuickCreateTaskDialog({ open, onClose }: Props) {
  const {
    spaces, projects, addTask, teamMembers,
    getListsForProject, getProjectsForSpace, canAccessSpace,
  } = useApp();
  const { teamMemberId } = useAuth();

  /* mode: 'write' | 'voice' */
  const [mode, setMode] = useState<'write' | 'voice'>('write');

  /* ── Write form state ── */
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [spaceId, setSpaceId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [startDate, setStartDate] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  /* ── Voice state ── */
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'parsing' | 'preview'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [voiceParsed, setVoiceParsed] = useState<any>(null);
  const [voiceError, setVoiceError] = useState('');
  const [showVoiceDetails, setShowVoiceDetails] = useState(true);
  const recognitionRef = useRef<any>(null);

  /* ── Derived lists ── */
  const visibleSpaces = spaces.filter(s => canAccessSpace(s.id));
  const projectsForSpace = spaceId ? getProjectsForSpace(spaceId) : [];

  /* Reset projectId when space changes */
  useEffect(() => { setProjectId(''); }, [spaceId]);

  /* Reset everything when dialog opens */
  useEffect(() => {
    if (open) {
      setMode('write');
      setTitle(''); setDescription(''); setPriority('normal');
      setSpaceId(''); setProjectId('');
      setDueDate(''); setDueTime(''); setStartDate('');
      setAssigneeIds([]); setSubtasks([]); setNewSubtask('');
      resetVoice();
    }
  }, [open]);

  /* ── Resolve listId ── */
  function resolveListId(): string {
    if (projectId) {
      const lists = getListsForProject(projectId);
      if (lists.length > 0) return lists[0].id;
    }
    return 'l1';
  }

  /* ── Write: toggle assignee ── */
  function toggleAssignee(id: string) {
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  /* ── Write: add subtask on Enter ── */
  function handleSubtaskKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && newSubtask.trim()) {
      e.preventDefault();
      setSubtasks(prev => [...prev, newSubtask.trim()]);
      setNewSubtask('');
    }
  }

  /* ── Write: submit ── */
  function submitWrite() {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      description,
      status: 'todo',
      priority,
      dueDate: dueDate || null,
      startDate: startDate || null,
      assigneeIds,
      tags: [],
      parentTaskId: null,
      listId: resolveListId(),
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    subtasks.forEach(st => {
      addTask({
        title: st,
        description: '',
        status: 'todo',
        priority: 'normal',
        dueDate: null,
        startDate: null,
        assigneeIds: [],
        tags: [],
        parentTaskId: null,
        listId: resolveListId(),
        comments: [],
        attachments: [],
        timeEstimate: null,
        timeLogged: null,
        aiSummary: null,
      });
    });
    const sub = subtasks.length > 0 ? ` + ${subtasks.length} sous-tâche${subtasks.length > 1 ? 's' : ''}` : '';
    toast.success(`Tâche créée : "${title.trim()}"${sub}`);
    onClose();
  }

  /* ── Voice: reset ── */
  function resetVoice() {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    setVoicePhase('idle');
    setTranscript(''); setInterimText('');
    setVoiceParsed(null); setVoiceError('');
  }

  /* ── Voice: start listening ── */
  const startListening = useCallback(() => {
    if (!SR) { setVoiceError("La reconnaissance vocale n'est pas supportée. Utilisez Chrome ou Edge."); return; }
    setVoiceError(''); setTranscript(''); setInterimText(''); setVoiceParsed(null);
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let fin = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      if (fin) setTranscript(fin);
      setInterimText(interim);
    };
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') setVoiceError('Accès au microphone refusé.');
      else if (e.error !== 'aborted') setVoiceError(`Erreur micro : ${e.error}`);
      setVoicePhase('idle');
    };
    rec.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch {}
      }
    };
    recognitionRef.current = rec;
    rec.start();
    setVoicePhase('listening');
  }, []);

  /* ── Voice: stop & parse ── */
  const stopAndParse = useCallback(async () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    const text = (transcript + ' ' + interimText).trim() || transcript || interimText;
    if (!text.trim()) { setVoiceError('Aucun texte détecté. Réessayez.'); setVoicePhase('idle'); return; }
    setTranscript(text); setInterimText(''); setVoicePhase('parsing');
    try {
      const parsed = await parseVoice(text);
      parsed.dueDate = resolveDate(parsed.dueDate);
      parsed.startDate = resolveDate(parsed.startDate);
      setVoiceParsed(parsed);
      setVoicePhase('preview');
    } catch (err: any) {
      setVoiceError(err.message || "Erreur lors de l'analyse");
      setVoicePhase('idle');
    }
  }, [transcript, interimText]);

  /* ── Voice: confirm create ── */
  const confirmVoice = useCallback(() => {
    if (!voiceParsed) return;
    const ids = (voiceParsed.assignees as string[])
      .map((name: string) => {
        const l = name.toLowerCase();
        return teamMembers.find(m =>
          m.name.toLowerCase().includes(l) || l.includes(m.name.split(' ')[0].toLowerCase())
        )?.id;
      })
      .filter(Boolean) as string[];

    addTask({
      title: voiceParsed.title,
      description: voiceParsed.description || '',
      status: 'todo',
      priority: voiceParsed.priority,
      dueDate: voiceParsed.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(voiceParsed.dueDate) ? voiceParsed.dueDate : null,
      startDate: voiceParsed.startDate && /^\d{4}-\d{2}-\d{2}$/.test(voiceParsed.startDate) ? voiceParsed.startDate : null,
      assigneeIds: ids,
      tags: voiceParsed.tags || [],
      parentTaskId: null,
      listId: resolveListId(),
      comments: [],
      attachments: [],
      timeEstimate: voiceParsed.timeEstimate || null,
      timeLogged: null,
      aiSummary: null,
    });
    if (voiceParsed.subtasks?.length > 0) {
      setTimeout(() => {
        voiceParsed.subtasks.forEach((st: string) => {
          addTask({
            title: st, description: '', status: 'todo', priority: 'normal',
            dueDate: null, startDate: null, assigneeIds: [], tags: [],
            parentTaskId: null, listId: resolveListId(),
            comments: [], attachments: [], timeEstimate: null, timeLogged: null, aiSummary: null,
          });
        });
      }, 300);
    }
    const sub = voiceParsed.subtasks?.length > 0
      ? ` + ${voiceParsed.subtasks.length} sous-tâche${voiceParsed.subtasks.length > 1 ? 's' : ''}`
      : '';
    toast.success(`Tâche créée : "${voiceParsed.title}"${sub}`);
    onClose();
  }, [voiceParsed, addTask, teamMembers, projectId, onClose]);

  /* Cleanup on unmount */
  useEffect(() => () => { if (recognitionRef.current) recognitionRef.current.stop(); }, []);

  /* ── Handle close ── */
  function handleClose() {
    resetVoice();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Créer une tâche
          </DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => { resetVoice(); setMode('write'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              mode === 'write'
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            <Pen className="w-3.5 h-3.5" />
            Écrire
          </button>
          <button
            onClick={() => { setMode('voice'); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              mode === 'voice'
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Dicter
          </button>
        </div>

        {/* ══════════════ WRITE MODE ══════════════ */}
        {mode === 'write' && (
          <div className="space-y-4">

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Titre *</label>
              <Input
                autoFocus
                placeholder="Nom de la tâche…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitWrite()}
              />
            </div>

            {/* Space + Project */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Espace</label>
                <Select value={spaceId} onValueChange={setSpaceId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projet</label>
                <Select value={projectId} onValueChange={setProjectId} disabled={!spaceId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder={spaceId ? 'Choisir…' : '— sélect. un espace —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsForSpace.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Priorité</label>
              <div className="flex gap-2">
                {PRIORITY_CONFIG.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      priority === p.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date début</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date échéance</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="text-sm" />
              </div>
            </div>

            {/* Due time */}
            {dueDate && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Heure</label>
                <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="text-sm w-40" />
              </div>
            )}

            {/* Assignees */}
            {teamMembers.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsable(s)</label>
                <div className="flex flex-wrap gap-1.5">
                  {teamMembers.map(m => {
                    const sel = assigneeIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => toggleAssignee(m.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          sel
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                          style={{ background: m.avatarColor }}
                        >
                          {m.name[0]}
                        </span>
                        {m.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
              <Textarea
                placeholder="Détails de la tâche…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            {/* Subtasks */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sous-tâches</label>
              <div className="space-y-1">
                {subtasks.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded border border-border shrink-0" />
                    <span className="flex-1 text-foreground">{st}</span>
                    <button
                      onClick={() => setSubtasks(prev => prev.filter((_, j) => j !== i))}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Plus className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Ajouter une sous-tâche (Entrée)"
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={handleSubtaskKey}
                    className="h-7 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleClose}>Annuler</Button>
              <Button size="sm" onClick={submitWrite} disabled={!title.trim()}>
                <Check className="w-4 h-4 mr-1" />
                Créer la tâche
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════ VOICE MODE ══════════════ */}
        {mode === 'voice' && (
          <div className="space-y-4">

            {/* Space + Project (aussi pour la voix) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Espace</label>
                <Select value={spaceId} onValueChange={setSpaceId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projet</label>
                <Select value={projectId} onValueChange={setProjectId} disabled={!spaceId}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder={spaceId ? 'Choisir…' : '— sélect. un espace —'} />
                  </SelectTrigger>
                  <SelectContent>
                    {projectsForSpace.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Error */}
            {voiceError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{voiceError}</span>
              </div>
            )}

            {/* Idle */}
            {voicePhase === 'idle' && (
              <div className="text-center py-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Appuyez sur le micro et décrivez votre tâche.<br />
                  <span className="text-xs opacity-70">
                    Ex : "Préparer la réunion de vendredi, priorité haute, assigner à Cécile, avec comme sous-tâches réserver la salle et envoyer les invitations"
                  </span>
                </p>
                {!SR && (
                  <p className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded-lg">
                    ⚠️ La reconnaissance vocale nécessite Chrome, Edge ou Safari.
                  </p>
                )}
                <button
                  onClick={startListening}
                  disabled={!SR}
                  className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Mic className="w-7 h-7 text-primary-foreground" />
                </button>
              </div>
            )}

            {/* Listening */}
            {voicePhase === 'listening' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-1 h-12">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      style={{
                        animation: `voicePulse 0.8s ease-in-out ${i * 0.07}s infinite alternate`,
                        height: '8px',
                      }}
                    />
                  ))}
                </div>
                <style>{`
                  @keyframes voicePulse {
                    from { height: 8px; opacity: 0.4; }
                    to { height: 32px; opacity: 1; }
                  }
                `}</style>
                <div className="min-h-[60px] p-3 rounded-lg bg-muted/50 border border-border">
                  {transcript && <span className="text-sm text-foreground">{transcript}</span>}
                  {interimText && <span className="text-sm text-muted-foreground italic"> {interimText}</span>}
                  {!transcript && !interimText && (
                    <span className="text-sm text-muted-foreground animate-pulse">Écoute en cours…</span>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" onClick={resetVoice}>
                    <X className="w-4 h-4 mr-1" /> Annuler
                  </Button>
                  <button
                    onClick={stopAndParse}
                    className="w-14 h-14 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/90 transition-all hover:scale-105 active:scale-95 shadow-lg animate-pulse"
                  >
                    <MicOff className="w-6 h-6 text-destructive-foreground" />
                  </button>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Appuyez sur le bouton rouge pour arrêter et analyser
                </p>
              </div>
            )}

            {/* Parsing */}
            {voicePhase === 'parsing' && (
              <div className="text-center py-6 space-y-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Analyse par l'IA en cours…</p>
                <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">"{transcript}"</p>
              </div>
            )}

            {/* Preview */}
            {voicePhase === 'preview' && voiceParsed && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Voici ce que j'ai compris :</p>
                <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                  <h4 className="text-base font-bold text-foreground">{voiceParsed.title}</h4>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      voiceParsed.priority === 'urgent' ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : voiceParsed.priority === 'high' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                      : voiceParsed.priority === 'low' ? 'bg-slate-500/10 text-slate-500 border-slate-500/20'
                      : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}>
                      {PRIORITY_LABELS[voiceParsed.priority as Priority] ?? voiceParsed.priority}
                    </span>
                    {voiceParsed.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(voiceParsed.dueDate) && (
                      <span className="text-xs bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-medium">
                        📅 {format(parseISO(voiceParsed.dueDate), 'd MMM yyyy', { locale: fr })}
                        {voiceParsed.dueTime && ` à ${voiceParsed.dueTime}`}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setShowVoiceDetails(v => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showVoiceDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Détails
                  </button>

                  {showVoiceDetails && (
                    <div className="space-y-2 pt-1">
                      {voiceParsed.description && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</span>
                          <p className="text-sm text-foreground mt-0.5">{voiceParsed.description}</p>
                        </div>
                      )}
                      {voiceParsed.assignees?.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigné à</span>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {voiceParsed.assignees.map((a: string) => (
                              <span key={a} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{a}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {voiceParsed.subtasks?.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                            Sous-tâches ({voiceParsed.subtasks.length})
                          </span>
                          <div className="space-y-1 mt-0.5">
                            {voiceParsed.subtasks.map((st: string, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                                <div className="w-4 h-4 rounded border border-border shrink-0" />
                                {st}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {voiceParsed.tags?.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tags</span>
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {voiceParsed.tags.map((t: string) => (
                              <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">#{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                    Texte dicté
                  </summary>
                  <p className="mt-1 p-2 rounded bg-muted/30 text-muted-foreground italic">"{transcript}"</p>
                </details>

                <div className="flex items-center gap-2 pt-1">
                  <Button variant="outline" className="flex-1" onClick={resetVoice}>
                    <Mic className="w-4 h-4 mr-1" /> Redicter
                  </Button>
                  <Button className="flex-1" onClick={confirmVoice}>
                    <Check className="w-4 h-4 mr-1" /> Créer la tâche
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
