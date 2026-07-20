import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Mic, MicOff, Loader2, Check, X, Sparkles, AlertCircle, ChevronDown, ChevronUp, Pencil, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, addDays, nextMonday, nextFriday, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PriorityBadge, StatusBadge } from '@/components/TaskBadges';
import { supabase } from '@/integrations/supabase/client';

/* ─── Types ─── */
interface ParsedTask {
  title: string;
  description: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: string;
  dueDate: string | null;
  dueTime: string | null;
  startDate: string | null;
  assignees: string[];
  tags: string[];
  subtasks: string[];
  timeEstimate: number | null;
}

/* ─── Speech Recognition setup ─── */
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

/* ─── Resolve relative dates ─── */
function resolveDate(raw: string | null): string | null {
  if (!raw) return null;
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const today = new Date();
  const lower = raw.toLowerCase().trim();

  if (lower === "aujourd'hui" || lower === 'today') return format(today, 'yyyy-MM-dd');
  if (lower === 'demain' || lower === 'tomorrow') return format(addDays(today, 1), 'yyyy-MM-dd');
  if (lower === 'après-demain' || lower === 'après demain') return format(addDays(today, 2), 'yyyy-MM-dd');
  if (lower.includes('lundi')) return format(nextMonday(today), 'yyyy-MM-dd');
  if (lower.includes('vendredi')) return format(nextFriday(today), 'yyyy-MM-dd');
  if (lower.includes('semaine prochaine')) return format(addDays(today, 7), 'yyyy-MM-dd');
  if (lower.includes('dans 2 semaines') || lower.includes('dans deux semaines')) return format(addDays(today, 14), 'yyyy-MM-dd');
  if (lower.includes('fin du mois')) {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return format(last, 'yyyy-MM-dd');
  }

  // Try parsing as-is
  try {
    const d = parseISO(raw);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  } catch {}

  return raw; // return raw if can't parse, will be ignored
}

/* ─── Parse Task API ─── */
const PARSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-parse-task`;

async function parseVoiceToTask(transcript: string): Promise<ParsedTask> {
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

/* ─── Component ─── */
interface VoiceTaskCreatorProps {
  onClose: () => void;
  defaultListId?: string;
  parentTaskId?: string | null;
  onParsed?: (parsed: ParsedTask, transcript: string) => void;
}

export default function VoiceTaskCreator({ onClose, defaultListId, parentTaskId = null, onParsed }: VoiceTaskCreatorProps) {
  const { addTask, teamMembers, selectedProjectId, getListsForProject, quickFilter } = useApp();
  const { teamMemberId } = useAuth();

  const [phase, setPhase] = useState<'idle' | 'listening' | 'parsing' | 'preview'>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState(true);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [serverTranscribing, setServerTranscribing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioMimeRef = useRef<string>('audio/webm');
  const audioBlobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Resolve listId
  const listId = defaultListId || (() => {
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    return lists[0]?.id || 'l1';
  })();

  // ─── Start listening ───
  const startListening = useCallback(async () => {
    setError('');
    setTranscript('');
    setInterimText('');
    setParsedTask(null);
    audioChunksRef.current = [];
    audioBlobRef.current = null;

    // Start MediaRecorder to capture audio for optional server re-transcription
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      audioMimeRef.current = recorder.mimeType || 'audio/webm';
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        audioBlobRef.current = new Blob(audioChunksRef.current, { type: audioMimeRef.current });
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err: any) {
      console.error('getUserMedia error:', err);
      setError('Accès au microphone refusé. Autorisez le micro dans les paramètres du navigateur.');
      return;
    }

    // Start Web Speech API in parallel (live transcript). Falls back gracefully.
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let final = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) final += result[0].transcript;
          else interim += result[0].transcript;
        }
        if (final) setTranscript(prev => (prev ? prev + ' ' : '') + final.trim());
        setInterimText(interim);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech error:', event.error);
        if (event.error === 'not-allowed') {
          setError('Accès au microphone refusé.');
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.warn(`SR error (non-fatal): ${event.error}`);
        }
      };

      recognitionRef.current = recognition;
      try { recognition.start(); } catch {}
    }

    setPhase('listening');
  }, []);

  // ─── Server re-transcription (fallback / quality boost) ───
  const runServerTranscription = useCallback(async (): Promise<string | null> => {
    const blob = audioBlobRef.current;
    if (!blob || blob.size < 1024) return null;
    try {
      // Convert blob to base64
      const b64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const s = String(reader.result || '');
          resolve(s.includes(',') ? s.split(',')[1] : s);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: b64, mimeType: blob.type || audioMimeRef.current, language: 'fr' },
      });
      if (error) throw error;
      const t = (data as any)?.transcript?.trim?.();
      return t || null;
    } catch (e: any) {
      console.error('server transcribe error', e);
      toast.error('Impossible de retranscrire (serveur)');
      return null;
    }
  }, []);

  // ─── Stop listening & parse ───
  const stopAndParse = useCallback(async () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    // Wait a tick for MediaRecorder onstop to flush
    await new Promise(r => setTimeout(r, 150));

    let fullText = (transcript + ' ' + interimText).trim();

    // If Web Speech gave nothing (Safari / iOS), try server transcription
    if (!fullText) {
      setPhase('parsing');
      setServerTranscribing(true);
      const serverText = await runServerTranscription();
      setServerTranscribing(false);
      if (serverText) fullText = serverText;
    }

    if (!fullText.trim()) {
      setError('Aucun texte détecté. Réessayez en parlant plus fort ou plus près du micro.');
      setPhase('idle');
      return;
    }

    setTranscript(fullText);
    setInterimText('');
    setPhase('parsing');

    try {
      const parsed = await parseVoiceToTask(fullText);
      parsed.dueDate = resolveDate(parsed.dueDate);
      parsed.startDate = resolveDate(parsed.startDate);
      setParsedTask(parsed);
      setPhase('preview');
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'analyse');
      setPhase('idle');
    }
  }, [transcript, interimText, runServerTranscription]);

  // ─── Re-run parsing on edited transcript ───
  const rerunParse = useCallback(async (newTranscript?: string) => {
    const text = (newTranscript ?? transcript).trim();
    if (!text) { toast.error('Texte vide'); return; }
    setRerunning(true);
    try {
      const parsed = await parseVoiceToTask(text);
      parsed.dueDate = resolveDate(parsed.dueDate);
      parsed.startDate = resolveDate(parsed.startDate);
      setParsedTask(parsed);
      toast.success('Analyse mise à jour');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setRerunning(false);
    }
  }, [transcript]);

  // ─── Retry via server transcription from the recorded audio ───
  const retryServerTranscription = useCallback(async () => {
    setServerTranscribing(true);
    const serverText = await runServerTranscription();
    setServerTranscribing(false);
    if (!serverText) {
      toast.error('Aucun audio disponible pour retranscrire');
      return;
    }
    setTranscript(serverText);
    toast.success('Transcription IA obtenue');
    await rerunParse(serverText);
  }, [runServerTranscription, rerunParse]);

  // ─── Cancel listening ───
  const cancel = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setPhase('idle');
    setTranscript('');
    setInterimText('');
    setParsedTask(null);
    setError('');
  }, []);

  // ─── Confirm & create tasks ───
  const confirmCreate = useCallback(() => {
    if (!parsedTask) return;

    // Find assignee IDs from names
    const assigneeIds = parsedTask.assignees
      .map(name => {
        const lower = name.toLowerCase();
        return teamMembers.find(m =>
          m.name.toLowerCase().includes(lower) ||
          lower.includes(m.name.split(' ')[0].toLowerCase())
        )?.id;
      })
      .filter(Boolean) as string[];

    // Auto-assign current user if 'my_tasks' filter is active and no assignees detected
    if (assigneeIds.length === 0 && quickFilter === 'my_tasks' && teamMemberId) {
      assigneeIds.push(teamMemberId);
    }

    // Create main task
    addTask({
      title: parsedTask.title,
      description: parsedTask.description || '',
      status: 'todo',
      priority: parsedTask.priority,
      dueDate: parsedTask.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedTask.dueDate) ? parsedTask.dueDate : null,
      startDate: parsedTask.startDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedTask.startDate) ? parsedTask.startDate : null,
      assigneeIds,
      tags: parsedTask.tags,
      parentTaskId: parentTaskId,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: parsedTask.timeEstimate,
      timeLogged: null,
      aiSummary: null,
    });

    // Create subtasks (slight delay to ensure parent exists)
    if (parsedTask.subtasks.length > 0) {
      // We can't easily get the parent ID since addTask is async via mutation
      // Subtasks will be created at root level with a note
      setTimeout(() => {
        parsedTask.subtasks.forEach((st, i) => {
          addTask({
            title: st,
            description: '',
            status: 'todo',
            priority: 'normal',
            dueDate: null,
            startDate: null,
            assigneeIds: [],
            tags: [],
            parentTaskId: null, // will need to be linked manually or via future task ID
            listId,
            comments: [],
            attachments: [],
            timeEstimate: null,
            timeLogged: null,
            aiSummary: null,
          });
        });
      }, 300);
    }

    const subtaskMsg = parsedTask.subtasks.length > 0
      ? ` + ${parsedTask.subtasks.length} sous-tâche${parsedTask.subtasks.length > 1 ? 's' : ''}`
      : '';
    toast.success(`Tâche créée : "${parsedTask.title}"${subtaskMsg}`);
    onClose();
  }, [parsedTask, addTask, teamMembers, listId, parentTaskId, onClose, quickFilter, teamMemberId]);

  // ─── Cleanup on unmount ───
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try { mediaRecorderRef.current.stop(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ─── Render ───
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <Card className="w-full max-w-lg mx-4 shadow-2xl border-primary/20" onClick={(e) => e.stopPropagation()}>
        <CardContent className="pt-5 pb-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Créer par la voix</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ─── Phase: IDLE ─── */}
          {phase === 'idle' && !error && (
            <div className="text-center py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Appuyez sur le micro et décrivez votre tâche.<br />
                <span className="text-xs opacity-70">
                  Ex: "Préparer la réunion de vendredi, priorité haute, assigner à Cécile,
                  avec comme sous-tâches réserver la salle et envoyer les invitations"
                </span>
              </p>
              <button
                onClick={startListening}
                className="mx-auto w-16 h-16 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-lg"
              >
                <Mic className="w-7 h-7 text-primary-foreground" />
              </button>
            </div>
          )}

          {/* ─── Phase: LISTENING ─── */}
          {phase === 'listening' && (
            <div className="space-y-4">
              {/* Waveform animation */}
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

              {/* Live transcript */}
              <div className="min-h-[60px] p-3 rounded-lg bg-muted/50 border border-border">
                {transcript && <span className="text-sm text-foreground">{transcript}</span>}
                {interimText && <span className="text-sm text-muted-foreground italic"> {interimText}</span>}
                {!transcript && !interimText && (
                  <span className="text-sm text-muted-foreground animate-pulse">Écoute en cours…</span>
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" size="sm" onClick={cancel}>
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

          {/* ─── Phase: PARSING ─── */}
          {phase === 'parsing' && (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                {serverTranscribing ? 'Transcription IA de l\'audio…' : 'Analyse par l\'IA en cours…'}
              </p>
              {transcript && <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">"{transcript}"</p>}
            </div>
          )}

          {/* ─── Phase: PREVIEW ─── */}
          {phase === 'preview' && parsedTask && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Voici ce que j'ai compris :</p>

              {/* Title */}
              <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-2">
                <h4 className="text-base font-bold text-foreground">{parsedTask.title}</h4>

                <div className="flex items-center gap-2 flex-wrap">
                  <PriorityBadge priority={parsedTask.priority} />
                  <StatusBadge status="todo" />
                  {parsedTask.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedTask.dueDate) && (
                    <span className="text-xs bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded-full font-medium">
                      📅 {format(parseISO(parsedTask.dueDate), 'd MMM yyyy', { locale: fr })}
                      {parsedTask.dueTime && ` à ${parsedTask.dueTime}`}
                    </span>
                  )}
                </div>

                {/* Toggle details */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Détails
                </button>

                {showDetails && (
                  <div className="space-y-2 pt-1">
                    {/* Description */}
                    {parsedTask.description && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</span>
                        <p className="text-sm text-foreground mt-0.5">{parsedTask.description}</p>
                      </div>
                    )}

                    {/* Assignees */}
                    {parsedTask.assignees.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigné à</span>
                        <div className="flex gap-1 mt-0.5">
                          {parsedTask.assignees.map(a => (
                            <span key={a} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {parsedTask.tags.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tags</span>
                        <div className="flex gap-1 mt-0.5">
                          {parsedTask.tags.map(t => (
                            <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subtasks */}
                    {parsedTask.subtasks.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Sous-tâches (<span data-numeric className="font-numeric tabular-nums">{parsedTask.subtasks.length}</span>)
                        </span>
                        <div className="space-y-1 mt-0.5">
                          {parsedTask.subtasks.map((st, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-foreground">
                              <div className="w-4 h-4 rounded border border-border shrink-0" />
                              {st}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Start date */}
                    {parsedTask.startDate && /^\d{4}-\d{2}-\d{2}$/.test(parsedTask.startDate) && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Date de début</span>
                        <p className="text-sm text-foreground mt-0.5">
                          {format(parseISO(parsedTask.startDate), 'd MMM yyyy', { locale: fr })}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Transcript source */}
              <details className="text-xs">
                <summary className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Texte dicté original
                </summary>
                <p className="mt-1 p-2 rounded bg-muted/30 text-muted-foreground italic">"{transcript}"</p>
              </details>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { cancel(); }}>
                  <Mic className="w-4 h-4 mr-1" /> Redicter
                </Button>
                <Button className="flex-1" onClick={confirmCreate}>
                  <Check className="w-4 h-4 mr-1" /> Créer la tâche
                </Button>
              </div>
            </div>
          )}

          {/* Browser support hint */}
          {phase === 'idle' && !SpeechRecognition && (
            <div className="text-xs text-center text-amber-500 bg-amber-500/10 p-2 rounded-lg">
              ⚠️ La reconnaissance vocale nécessite Chrome, Edge ou Safari.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
