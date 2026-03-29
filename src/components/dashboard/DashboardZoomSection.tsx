import React, { useEffect, useState, useRef, useCallback } from "react";
import { useZoom, ZoomMeeting } from "@/hooks/useZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ExternalLink, Copy, Clock, Plus, Video, Loader2, LinkIcon, Settings, AlertCircle, Volume2, VolumeX } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import { useNavigate } from "react-router-dom";
import { format, parseISO, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_VISIBLE = 5;

/** Play a short notification chime using Web Audio API */
function playZoomAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 – ascending triad
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
    // Close context after sound completes
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // Web Audio not supported – silent fallback
  }
}

export default function DashboardZoomSection() {
  const { isActive, integrations } = useIntegrations();
  const navigate = useNavigate();
  const zoom = useZoom();
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
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
  const alertedMeetingsRef = useRef<Set<string>>(new Set());
  const zoomEnabled = integrations.zoom?.is_enabled ?? false;
  const zoomActive = isActive('zoom');

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem("zoom_alert_sound", next ? "on" : "off"); } catch {}
      return next;
    });
  }, []);

  // Check for imminent meetings and play alert sound
  useEffect(() => {
    if (!soundEnabled || meetings.length === 0) return;
    const interval = setInterval(() => {
      const now = new Date();
      for (const m of meetings) {
        if (!m.start_time || alertedMeetingsRef.current.has(m.id)) continue;
        const minsLeft = differenceInMinutes(parseISO(m.start_time), now);
        if (minsLeft <= 15 && minsLeft >= 0) {
          alertedMeetingsRef.current.add(m.id);
          playZoomAlertSound();
          toast.info(`🎥 "${m.topic}" commence dans ${minsLeft} min`, { duration: 8000 });
          break; // one alert at a time
        }
      }
    }, 30_000); // check every 30s
    // Also check immediately
    const now = new Date();
    for (const m of meetings) {
      if (!m.start_time || alertedMeetingsRef.current.has(m.id)) continue;
      const minsLeft = differenceInMinutes(parseISO(m.start_time), now);
      if (minsLeft <= 15 && minsLeft >= 0) {
        alertedMeetingsRef.current.add(m.id);
        playZoomAlertSound();
        toast.info(`🎥 "${m.topic}" commence dans ${minsLeft} min`, { duration: 8000 });
        break;
      }
    }
    return () => clearInterval(interval);
  }, [meetings, soundEnabled]);

  const fetchMeetings = async () => {
    if (!zoomActive || !zoom.isConnected) { setLoading(false); return; }
    try {
      const res = await zoom.listMeetings("project", "");
      setMeetings(
        (res?.meetings ?? res?.data ?? [])
          .filter((m: ZoomMeeting) => !m.start_time || isFuture(parseISO(m.start_time)))
          .sort((a: ZoomMeeting, b: ZoomMeeting) => {
            if (!a.start_time) return 1;
            if (!b.start_time) return -1;
            return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          })
      );
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchMeetings(); }, [zoom.isConnected, zoomActive]);

  const handleCreate = async (instant = false) => {
    setCreating(true);
    try {
      await zoom.createMeeting(
        topic || "Réunion rapide",
        "project",
        "",
        instant ? undefined : startTime || undefined,
        duration
      );
      toast.success("Réunion créée ✅");
      setDialogOpen(false);
      setTopic("Réunion rapide");
      setStartTime("");
      setDuration(30);
      await fetchMeetings();
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la création");
    }
    setCreating(false);
  };

  if (!zoomEnabled && !zoomActive) return null;

  const visible = expanded ? meetings : meetings.slice(0, MAX_VISIBLE);
  const remaining = meetings.length - MAX_VISIBLE;

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
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                onClick={toggleSound}
                title={soundEnabled ? "Désactiver le son d'alerte" : "Activer le son d'alerte"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                onClick={() => setDialogOpen(true)}
                disabled={!zoom.isConnected}
              >
                <Plus className="w-3.5 h-3.5" />
                Nouvelle
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
              <p className="text-sm text-muted-foreground text-center">Zoom n'est pas encore connecté</p>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => zoom.connect()}
              >
                <Video className="w-3.5 h-3.5" />
                Connecter Zoom
              </Button>
              <button
                onClick={() => navigate("/settings")}
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                Paramètres d'intégration
              </button>
            </div>
          ) : meetings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune réunion à venir</p>
          ) : (
            <div className="space-y-1">
              {visible.map((m) => {
                const isSoon = m.start_time && differenceInMinutes(parseISO(m.start_time), new Date()) <= 15 && differenceInMinutes(parseISO(m.start_time), new Date()) >= 0;
                return (
                <div
                  key={m.id}
                  className={`w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md group ${isSoon ? 'bg-destructive/10 border border-destructive/20 animate-pulse' : ''}`}
                >
                  <div className={`p-1.5 rounded-md shrink-0 ${isSoon ? 'bg-destructive/20' : 'bg-muted/50'}`}>
                    {isSoon ? (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <img src={INTEGRATION_CONFIG.zoom.icon} alt="" className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm truncate ${isSoon ? 'text-destructive font-semibold' : 'text-foreground'}`}>{m.topic}</p>
                      {isSoon && (
                        <span className="text-[10px] font-bold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                          Imminent
                        </span>
                      )}
                    </div>
                    {m.start_time && (
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${isSoon ? 'text-destructive/80' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        {format(parseISO(m.start_time), "d MMM · HH:mm", { locale: fr })}
                        {m.duration > 0 && ` · ${m.duration} min`}
                      </p>
                    )}
                  </div>
                  {isSoon && (
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-xs gap-1 shrink-0"
                      onClick={() => window.open(m.join_url, "_blank")}
                    >
                      <Video className="w-3.5 h-3.5" />
                      Rejoindre
                    </Button>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => window.open(m.join_url, "_blank")}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                      title="Rejoindre"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(m.join_url);
                        toast.success("Lien copié ✅");
                      }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                      title="Copier le lien"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                );
              })}
              {remaining > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
                >
                  {expanded ? (
                    <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                  ) : (
                    <>+{remaining} autre{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Nouvelle réunion Zoom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="zoom-topic">Sujet</Label>
              <Input
                id="zoom-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Nom de la réunion"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="zoom-start">Date & heure (optionnel)</Label>
                <Input
                  id="zoom-start"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zoom-duration">Durée (min)</Label>
                <Input
                  id="zoom-duration"
                  type="number"
                  min={5}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => handleCreate(true)}
              disabled={creating}
              className="flex-1"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
              Instantanée
            </Button>
            <Button
              onClick={() => handleCreate(false)}
              disabled={creating}
              className="flex-1"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Planifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
