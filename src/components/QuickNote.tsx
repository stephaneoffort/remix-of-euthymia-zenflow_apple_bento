import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import {
  Mic, Square, Play, Pause, Send, NotebookPen, X, Trash2, Clock, Copy, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member  { id: string; name: string; }
interface Channel { id: string; name: string; type: string; }
interface ParsedIntent { recipient: Member | null; channel: Channel | null; content: string; }

// ─── Intent parser ────────────────────────────────────────────────────────────

function parseIntent(text: string, members: Member[], channels: Channel[]): ParsedIntent | null {
  if (!text.toLowerCase().trimStart().startsWith('message pour ')) return null;

  // Strip leading phrase
  let rest = text.trimStart().slice('message pour '.length);

  // Try to match a known member name (full then first name, longest first)
  let recipient: Member | null = null;
  const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
  for (const m of sorted) {
    const firstName = m.name.split(' ')[0];
    const lo = rest.toLowerCase();
    if (lo.startsWith(m.name.toLowerCase() + ' ') || lo.startsWith(m.name.toLowerCase() + ',')) {
      recipient = m;
      rest = rest.slice(m.name.length).trimStart();
      break;
    }
    if (lo.startsWith(firstName.toLowerCase() + ' ') || lo.startsWith(firstName.toLowerCase() + ',')) {
      recipient = m;
      rest = rest.slice(firstName.length).trimStart();
      break;
    }
  }

  // Try to match a channel after "dans [le canal] [#]"
  let channel: Channel | null = null;
  const chanRx = /^dans\s+(?:le\s+canal\s+|le\s+|#)?([^\s,]+)[,\s]*(.*)/i;
  const chanMatch = rest.match(chanRx);
  if (chanMatch) {
    const slug = chanMatch[1].toLowerCase();
    const found = channels.find(c =>
      c.name.toLowerCase() === slug || c.name.toLowerCase().includes(slug)
    );
    if (found) {
      channel = found;
      rest = chanMatch[2].trimStart();
    }
  }

  // Default: first public channel whose name contains "général" or just first public
  if (!channel) {
    channel =
      channels.find(c => c.type === 'public' && ['général','general','générale'].some(g => c.name.toLowerCase().includes(g)))
      ?? channels.find(c => c.type === 'public')
      ?? null;
  }

  const content = rest.replace(/^[,:]\s*/, '').trim();
  return { recipient, channel, content };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function bestMimeType(): string {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SavedNote { id: string; text: string; createdAt: string; }

function loadSavedNotes(): SavedNote[] {
  try { return JSON.parse(localStorage.getItem('quick_notes') || '[]'); } catch { return []; }
}

export function QuickNote() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'compose' | 'list'>('compose');
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [savedNotes, setSavedNotes] = useState<SavedNote[]>([]);

  const recorderRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const recognRef     = useRef<any>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const usedWebSpeechRef = useRef<boolean>(false);
  const recordMimeRef = useRef<string>('');
  const [transcribing, setTranscribing] = useState(false);

  // Web Speech API is unreliable on mobile (iOS Safari, Firefox Android, etc.)
  // We force server-side transcription on mobile for consistency.
  const hasWebSpeech =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const isMobile =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const useServerTranscription = !hasWebSpeech || isMobile;

  // ── Keyboard shortcut Ctrl/⌘+Shift+N + custom event ──────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === 'N') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    const onEvent = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('quicknote:open', onEvent);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('quicknote:open', onEvent);
    };
  }, []);

  // ── Load data on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSavedNotes(loadSavedNotes());
    if (!user) return;
    Promise.all([
      db.from('team_members').select('id, name'),
      db.from('chat_channels').select('id, name, type').eq('is_archived', false).order('position'),
    ]).then(([{ data: m }, { data: c }]) => {
      setMembers(m || []);
      setChannels(c || []);
    });
  }, [open, user]);

  const refreshNotes = () => setSavedNotes(loadSavedNotes());

  const deleteNote = (id: string) => {
    const next = loadSavedNotes().filter(n => n.id !== id);
    localStorage.setItem('quick_notes', JSON.stringify(next));
    setSavedNotes(next);
    toast.success('Note supprimée');
  };

  const copyNote = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Note copiée');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const intent = text.trim() ? parseIntent(text, members, channels) : null;

  // ── Recording ──────────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = bestMimeType();
      recordMimeRef.current = mime || 'audio/webm';
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      finalTranscriptRef.current = '';
      usedWebSpeechRef.current = false;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recordMimeRef.current });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        // If Web Speech didn't run (mobile / unsupported), transcribe server-side.
        if (!usedWebSpeechRef.current && blob.size > 0) {
          await transcribeBlobOnServer(blob, recordMimeRef.current);
        }
      };

      recorder.start(200);
      setIsRecording(true);
      setRecordSecs(0);
      timerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);

      // Only attempt Web Speech on desktop. On mobile we rely on server transcription
      // (Web Speech is missing on iOS Safari / Firefox Android, and silently fails
      // on Chrome Android when called after an `await` — gesture context is lost).
      if (!useServerTranscription) {
        startRecognition();
      }
    } catch {
      toast.error("Impossible d'accéder au microphone");
    }
  };

  const transcribeBlobOnServer = async (blob: Blob, mime: string) => {
    setTranscribing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // strip "data:audio/...;base64," prefix
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64, mimeType: mime, language: 'français' },
      });

      if (error) throw error;
      const transcript = (data as any)?.transcript?.trim?.() || '';
      if (transcript) {
        setText(prev => (prev ? prev + ' ' : '') + transcript);
        toast.success('Transcription terminée');
      } else {
        toast.warning('Aucun texte détecté dans l’audio');
      }
    } catch (e: any) {
      console.error('Transcription failed:', e);
      toast.error(e?.message || 'Échec de la transcription audio');
    } finally {
      setTranscribing(false);
    }
  };

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
    if (recognRef.current) { try { recognRef.current.stop(); } catch {} recognRef.current = null; }
    setIsRecording(false);
  }, []);

  const startRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const r = new SR();
    r.lang = 'fr-FR';
    r.continuous = true;
    r.interimResults = true;
    recognRef.current = r;
    usedWebSpeechRef.current = true;
    finalTranscriptRef.current = '';

    r.onresult = (ev: any) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTranscriptRef.current += t + ' ';
        else interim = t;
      }
      setLiveTranscript(finalTranscriptRef.current + interim);
    };
    r.onerror = (ev: any) => {
      // network / not-allowed / aborted etc. — fall back silently to server transcription on stop
      console.warn('SpeechRecognition error:', ev?.error);
      usedWebSpeechRef.current = false;
    };
    r.onend = () => {
      const final = finalTranscriptRef.current.trim();
      if (final) {
        setText(prev => (prev ? prev + ' ' : '') + final);
        setLiveTranscript('');
        finalTranscriptRef.current = '';
      }
    };
    try { r.start(); } catch { usedWebSpeechRef.current = false; }
  };

  // ── Playback ───────────────────────────────────────────────────────────────
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else           { audioRef.current.play();  setIsPlaying(true);  }
  };

  // ── Save / Send ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!user || !text.trim()) return;
    setSaving(true);
    try {
      if (intent) {
        const mention = intent.recipient ? `@${intent.recipient.name} ` : '';
        const content = mention + (intent.content || text.trim());

        let mentionedUsers: string[] = [];
        if (intent.recipient) {
          const { data: prof } = await db
            .from('profiles').select('id')
            .eq('team_member_id', intent.recipient.id).maybeSingle();
          if (prof?.id) mentionedUsers = [prof.id];
        }

        await db.from('chat_messages').insert({
          channel_id: intent.channel?.id,
          user_id: user.id,
          content,
          mentioned_users: mentionedUsers,
        });

        toast.success(`Message envoyé dans #${intent.channel?.name ?? 'général'}`, {
          description: intent.recipient ? `Mention : @${intent.recipient.name}` : undefined,
        });
      } else {
        // Save to localStorage (max 50 notes)
        const all = loadSavedNotes();
        const next = [{ id: String(Date.now()), text: text.trim(), createdAt: new Date().toISOString() }, ...all].slice(0, 50);
        localStorage.setItem('quick_notes', JSON.stringify(next));
        setSavedNotes(next);
        toast.success('Note sauvegardée');
        setText('');
        setAudioUrl(null);
        setLiveTranscript('');
        setRecordSecs(0);
        setTab('list');
        setSaving(false);
        return;
      }
      handleClose();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // ── Reset / Close ──────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    stopRecording();
    setText('');
    setAudioUrl(null);
    setLiveTranscript('');
    setRecordSecs(0);
    setIsPlaying(false);
    setOpen(false);
  }, [stopRecording]);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (recognRef.current) try { recognRef.current.stop(); } catch {}
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  if (!user) return null;

  return (
    <>
      {/* ── Floating Action Button ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        title="Note rapide (Ctrl+Maj+N)"
        className={[
          'fixed right-4 z-40 w-12 h-12 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'hover:shadow-xl hover:scale-105 active:scale-95',
          'transition-all flex items-center justify-center',
          // Above MobileBottomNav on mobile (h-14 = 56px + 16px gap)
          'bottom-20 sm:bottom-6',
        ].join(' ')}
        style={{ paddingBottom: 0 }}
        aria-label="Note rapide"
      >
        <NotebookPen className="w-5 h-5" />
      </button>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={o => { if (!o) handleClose(); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 flex flex-col"
          style={{
            maxHeight: '85dvh',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* Header */}
          <SheetHeader className="px-4 pt-4 pb-0 border-b border-border shrink-0">
            <div className="flex flex-row items-center justify-between pb-3">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                <NotebookPen className="w-4 h-4" />
                Notes rapides
                <span className="text-[10px] text-muted-foreground font-normal hidden sm:inline ml-1">
                  Ctrl+Maj+N
                </span>
              </SheetTitle>
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Tabs */}
            <div className="flex gap-1 -mb-px">
              <button
                onClick={() => setTab('compose')}
                className={[
                  'px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5',
                  tab === 'compose'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <NotebookPen className="w-3.5 h-3.5" />
                Rédiger
              </button>
              <button
                onClick={() => { setTab('list'); refreshNotes(); }}
                className={[
                  'px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5',
                  tab === 'list'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                <FileText className="w-3.5 h-3.5" />
                Mes notes
                {savedNotes.length > 0 && (
                  <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums">
                    {savedNotes.length}
                  </span>
                )}
              </button>
            </div>
          </SheetHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">

            {tab === 'compose' && (
              <>
                {/* Text area */}
                <Textarea
                  placeholder={'Écrivez votre note…\n\nOu commencez par « message pour Marie, tu as reçu le fichier ? » pour envoyer dans le chat.\nAjoutez « dans #design » pour cibler un canal spécifique.'}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="min-h-[130px] resize-none text-sm leading-relaxed"
                  autoFocus
                />

                {/* Live transcript / recording / transcribing */}
                {(liveTranscript || isRecording) && (
                  <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-xs">
                    <span className="relative flex h-2 w-2 mt-0.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
                    </span>
                    <span className="italic">
                      {liveTranscript
                        ? liveTranscript
                        : useServerTranscription
                          ? 'Enregistrement… (transcription après l’arrêt)'
                          : 'Enregistrement…'}
                    </span>
                  </div>
                )}
                {transcribing && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-2 text-xs">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="italic">Transcription audio en cours…</span>
                  </div>
                )}

                {/* Intent preview */}
                {intent && (
                  <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-2 text-xs text-primary">
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Envoi dans <strong>#{intent.channel?.name ?? 'général'}</strong>
                      {intent.recipient && (
                        <> — mention <strong>@{intent.recipient.name}</strong></>
                      )}
                    </span>
                  </div>
                )}

                {/* Audio player */}
                {audioUrl && (
                  <div className="flex items-center gap-3 bg-muted/60 rounded-xl px-3 py-2.5">
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity"
                    >
                      {isPlaying
                        ? <Pause className="w-3.5 h-3.5" />
                        : <Play  className="w-3.5 h-3.5 ml-0.5" />
                      }
                    </button>
                    <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">Enregistrement audio</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">{fmt(recordSecs)}</p>
                    </div>
                    <button
                      onClick={() => { setAudioUrl(null); setRecordSecs(0); }}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </>
            )}

            {tab === 'list' && (
              <>
                {savedNotes.length === 0 ? (
                  <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p>Aucune note sauvegardée pour le moment.</p>
                    <button
                      onClick={() => setTab('compose')}
                      className="mt-3 text-xs text-primary hover:underline"
                    >
                      Rédiger une première note
                    </button>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {savedNotes.map(n => (
                      <li
                        key={n.id}
                        className="group border border-border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors"
                      >
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                          {n.text}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {new Date(n.createdAt).toLocaleString('fr-FR', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => copyNote(n.text)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Copier"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setText(n.text); setTab('compose'); }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              title="Réutiliser dans la rédaction"
                            >
                              <NotebookPen className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteNote(n.id)}
                              className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Action bar (compose only) */}
          {tab === 'compose' && (
            <div className="px-4 pb-4 pt-3 border-t border-border flex items-center gap-2 shrink-0">

              {/* Record / Stop */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={[
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all select-none',
                  isRecording
                    ? 'bg-destructive/15 text-destructive border border-destructive/30 animate-pulse'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80',
                ].join(' ')}
              >
                {isRecording ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <Clock className="w-3.5 h-3.5" />
                    <span className="tabular-nums text-xs">{fmt(recordSecs)}</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span className="hidden sm:inline text-xs">Enregistrer</span>
                  </>
                )}
              </button>

              <div className="flex-1" />

              <Button variant="ghost" size="sm" onClick={handleClose}>
                Annuler
              </Button>

              <Button
                size="sm"
                onClick={handleSend}
                disabled={!text.trim() || saving}
              >
                {intent ? (
                  <><Send className="w-3.5 h-3.5 mr-1.5" />Envoyer</>
                ) : (
                  <><NotebookPen className="w-3.5 h-3.5 mr-1.5" />Sauvegarder</>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
