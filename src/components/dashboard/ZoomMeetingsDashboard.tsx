import React, { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/context/AppContext";
import { useZoom } from "@/hooks/useZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, ExternalLink, Copy, Clock, Plus, Video, Loader2,
  LinkIcon, Settings, AlertCircle, Volume2, VolumeX, CalendarDays,
  CheckSquare, Layers, RefreshCw, Trash2,
} from "lucide-react";
import { differenceInMinutes, format, parseISO, isFuture, isToday, isTomorrow, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_VISIBLE = 5;

interface ZoomMeetingRow {
  id: string;
  topic: string;
  join_url: string;
  start_url: string;
  start_time: string | null;
  duration: number | null;
  password: string | null;
  status: string | null;
  entity_type: string;
  entity_id: string;
  zoom_meeting_id: number;
  created_at: string | null;
}

function playZoomAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

const ENTITY_BADGE: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  event:   { label: "Événement",  className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",   icon: <CalendarDays className="w-3 h-3" /> },
  task:    { label: "Tâche",      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: <CheckSquare className="w-3 h-3" /> },
  subtask: { label: "Sous-tâche", className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",  icon: <Layers className="w-3 h-3" /> },
  project: { label: "Projet",     className: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",  icon: <Layers className="w-3 h-3" /> },
};

function formatMeetingDate(startTime: string): string {
  const d = parseISO(startTime);
  if (isToday(d)) return `Aujourd'hui ${format(d, "HH'h'mm")}`;
  if (isTomorrow(d)) return `Demain ${format(d, "HH'h'mm")}`;
  return format(d, "EEE d MMM · HH'h'mm", { locale: fr });
}

export default function ZoomMeetingsDashboard() {
  const { setSelectedTaskId, setSelectedView } = useApp();
  const { isActive, integrations } = useIntegrations();
  const navigate = useNavigate();
  const zoom = useZoom();
  const [meetings, setMeetings] = useState<ZoomMeetingRow[]>([]);
  const [entityTitles, setEntityTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState("Réunion rapide");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem("zoom_alert_sound") !== "off"; } catch { return true; }
  });
  const [deleteTarget, setDeleteTarget] = useState<ZoomMeetingRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const alertedMeetingsRef = useRef<Set<string>>(new Set());

  const zoomEnabled = integrations.zoom?.is_enabled ?? false;
  const zoomActive = isActive("zoom");

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("zoom_alert_sound", next ? "on" : "off"); } catch {}
      return next;
    });
  }, []);

  // Fetch all meetings from supabase directly
  const fetchMeetings = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("zoom_meetings")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "ended")
        .order("start_time", { ascending: true })
        .limit(50);

      if (error) { console.error("Zoom fetch error:", error); setLoading(false); return; }

      const rows = (data ?? []) as ZoomMeetingRow[];
      setMeetings(rows);

      // Fetch entity titles
      const eventIds = rows.filter((r) => r.entity_type === "event").map((r) => r.entity_id);
      const taskIds = rows.filter((r) => r.entity_type === "task" || r.entity_type === "subtask").map((r) => r.entity_id);

      const titles: Record<string, string> = {};

      if (eventIds.length > 0) {
        const { data: events } = await supabase
          .from("calendar_events")
          .select("id, title")
          .in("id", eventIds);
        events?.forEach((e: any) => { titles[e.id] = e.title; });
      }
      if (taskIds.length > 0) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title")
          .in("id", taskIds);
        tasks?.forEach((t: any) => { titles[t.id] = t.title; });
      }

      setEntityTitles(titles);
    } catch (e) {
      console.error("Zoom dashboard fetch error:", e);
    }
    setLoading(false);
  }, []);

  // Initial + periodic refresh
  useEffect(() => {
    if (zoomActive && zoom.isConnected) fetchMeetings();
    else setLoading(false);
  }, [zoomActive, zoom.isConnected, fetchMeetings]);

  useEffect(() => {
    if (!zoomActive || !zoom.isConnected) return;
    const interval = setInterval(fetchMeetings, 60_000);
    return () => clearInterval(interval);
  }, [zoomActive, zoom.isConnected, fetchMeetings]);

  // Realtime subscription
  useEffect(() => {
    if (!zoomActive) return;
    const getUserAndSubscribe = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("zoom-meetings-dashboard")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "zoom_meetings",
          filter: `user_id=eq.${user.id}`,
        }, () => { fetchMeetings(); })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };
    let cleanup: (() => void) | undefined;
    getUserAndSubscribe().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [zoomActive, fetchMeetings]);

  // Alert sounds
  useEffect(() => {
    if (!soundEnabled || meetings.length === 0) return;
    const check = () => {
      const now = new Date();
      for (const m of meetings) {
        if (!m.start_time || alertedMeetingsRef.current.has(m.id)) continue;
        const mins = differenceInMinutes(parseISO(m.start_time), now);
        if (mins <= 15 && mins >= 0) {
          alertedMeetingsRef.current.add(m.id);
          playZoomAlertSound();
          toast.info(`🎥 "${m.topic}" commence dans ${mins} min`, { duration: 8000 });
          break;
        }
      }
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [meetings, soundEnabled]);

  const handleCreate = async (instant = false) => {
    setCreating(true);
    try {
      await zoom.createMeeting(topic || "Réunion rapide", "project", "", instant ? undefined : startTime || undefined, duration);
      toast.success("Réunion créée ✅");
      setDialogOpen(false);
      setTopic("Réunion rapide");
      setStartTime("");
      setDuration(30);
      await fetchMeetings();
    } catch (e: any) {
      console.error("Zoom create error:", e);
      toast.error(e?.message || "Erreur lors de la création");
    }
    setCreating(false);
  };

  const handleDeleteZoom = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await zoom.deleteMeeting(deleteTarget.id, deleteTarget.zoom_meeting_id);
      toast.success("Réunion supprimée ✅");
      setDeleteTarget(null);
      await fetchMeetings();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la suppression");
    }
    setDeleting(false);
  };

  const handleItemClick = (m: ZoomMeetingRow) => {
    if (m.entity_type === "task" || m.entity_type === "subtask") {
      setSelectedTaskId(m.entity_id);
    } else if (m.entity_type === "event") {
      setSelectedView("calendar");
    }
  };

  if (!zoomEnabled && !zoomActive) return null;

  // Stats
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const upcomingCount = meetings.filter((m) => m.start_time && isFuture(parseISO(m.start_time))).length;
  const todayCount = meetings.filter((m) => m.start_time && isToday(parseISO(m.start_time))).length;
  const thisMonthCount = meetings.filter((m) => {
    if (!m.start_time) return false;
    const d = parseISO(m.start_time);
    return d >= monthStart && d <= monthEnd;
  }).length;

  const visible = expanded ? meetings : meetings.slice(0, MAX_VISIBLE);
  const remaining = meetings.length - MAX_VISIBLE;

  const getMeetingTitle = (m: ZoomMeetingRow) => entityTitles[m.entity_id] || m.topic;
  const badge = (type: string) => ENTITY_BADGE[type] || ENTITY_BADGE.project;

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <img src={INTEGRATION_CONFIG.zoom.icon} alt="Zoom" className="w-5 h-5" />
            Réunions Zoom
            {meetings.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                {meetings.length}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                onClick={async () => { setLoading(true); await fetchMeetings(); }}
                title="Rafraîchir">
                <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={toggleSound}
                title={soundEnabled ? "Désactiver le son d'alerte" : "Activer le son d'alerte"}>
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                onClick={() => setDialogOpen(true)} disabled={!zoom.isConnected}>
                <Plus className="w-3.5 h-3.5" /> Nouvelle
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
          ) : !zoom.isConnected ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="p-3 rounded-full bg-muted/50">
                <LinkIcon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Connecte Zoom dans les Settings pour voir tes réunions ici
              </p>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => zoom.connect()}>
                <Video className="w-3.5 h-3.5" /> Connecter Zoom
              </Button>
              <button onClick={() => navigate("/settings")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                <Settings className="w-3 h-3" /> Paramètres d'intégration
              </button>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "À venir", value: upcomingCount, color: "text-primary" },
                  { label: "Aujourd'hui", value: todayCount, color: "text-amber-500" },
                  { label: "Ce mois", value: thisMonthCount, color: "text-emerald-500" },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                    <p data-numeric className={`font-numeric text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                  </div>
                ))}
              </div>

              {meetings.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <div className="p-3 rounded-full bg-muted/50">
                    <Video className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Aucune réunion à venir.
                  </p>
                  <p className="text-xs text-muted-foreground text-center">
                    Crée une session Zoom depuis un événement ou une tâche.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {visible.map((m) => {
                    const isSoon = m.start_time && differenceInMinutes(parseISO(m.start_time), now) <= 15 && differenceInMinutes(parseISO(m.start_time), now) >= 0;
                    const b = badge(m.entity_type);
                    return (
                      <div key={m.id}
                        onClick={() => handleItemClick(m)}
                        className={`w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-2 rounded-md group cursor-pointer ${isSoon ? "bg-destructive/10 border border-destructive/20 animate-pulse" : ""}`}>
                        <div className={`p-1.5 rounded-md shrink-0 ${isSoon ? "bg-destructive/20" : "bg-muted/50"}`}>
                          {isSoon ? <AlertCircle className="w-4 h-4 text-destructive" /> : <img src={INTEGRATION_CONFIG.zoom.icon} alt="" className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium ${b.className}`}>
                              {b.icon} {b.label}
                            </Badge>
                            {isSoon && (
                              <span className="text-[10px] font-bold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                                Imminent
                              </span>
                            )}
                          </div>
                          <p className={`text-sm truncate mt-0.5 ${isSoon ? "text-destructive font-semibold" : "text-foreground"}`}>
                            {getMeetingTitle(m)}
                          </p>
                          {m.start_time && (
                            <p className={`text-xs flex items-center gap-1 mt-0.5 ${isSoon ? "text-destructive/80" : "text-muted-foreground"}`}>
                              <Clock className="w-3 h-3" />
                              {formatMeetingDate(m.start_time)}
                              {m.duration && m.duration > 0 && ` · ${m.duration} min`}
                            </p>
                          )}
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          {isSoon && (
                            <Button size="sm" className="h-7 px-2.5 text-xs gap-1" style={{ backgroundColor: "#2D8CFF", color: "#fff" }}
                              onClick={() => window.open(m.join_url, "_blank")}>
                              <Video className="w-3.5 h-3.5" /> Rejoindre
                            </Button>
                          )}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => window.open(m.join_url, "_blank")}
                              className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors" title="Rejoindre">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => window.open(m.start_url, "_blank")}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Démarrer (hôte)">
                              <Video className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(m.join_url); toast.success("Lien copié ✅"); }}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="Copier le lien">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(m); }}
                              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {remaining > 0 && (
                    <button onClick={() => setExpanded(!expanded)}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5">
                      {expanded ? <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></> : <>+{remaining} autre{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" /> Nouvelle réunion Zoom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="zoom-topic">Sujet</Label>
              <Input id="zoom-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Nom de la réunion" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zoom-start">Date & heure (optionnel)</Label>
                <Input id="zoom-start" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zoom-duration">Durée (min)</Label>
                <Input id="zoom-duration" type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => handleCreate(true)} disabled={creating} className="flex-1">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />} Instantanée
            </Button>
            <Button onClick={() => handleCreate(false)} disabled={creating} className="flex-1">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Planifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réunion Zoom ?</AlertDialogTitle>
            <AlertDialogDescription>
              La réunion « {deleteTarget?.topic} » sera supprimée définitivement de Zoom et de l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteZoom} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
