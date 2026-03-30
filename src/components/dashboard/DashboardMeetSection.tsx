import React, { useEffect, useState, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown, Clock, ExternalLink, Copy, Video, AlertCircle, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  format, parseISO, isFuture, isToday, isTomorrow, startOfMonth, endOfMonth,
  differenceInMinutes,
} from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";

interface MeetEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_link: string;
}

const MAX_VISIBLE = 5;

function formatMeetDate(startTime: string): string {
  const d = parseISO(startTime);
  if (isToday(d)) return `Aujourd'hui ${format(d, "HH'h'mm")}`;
  if (isTomorrow(d)) return `Demain ${format(d, "HH'h'mm")}`;
  return format(d, "EEE d MMM · HH'h'mm", { locale: fr });
}

export default function DashboardMeetSection() {
  const { isActive } = useIntegrations();
  const { setSelectedView } = useApp();
  const [events, setEvents] = useState<MeetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const meetActive = isActive("google_meet");

  const fetchEvents = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time, meet_link, provider")
        .eq("has_meet", true)
        .not("meet_link", "is", null)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(50);
      const meetOnly = (data ?? []).filter(
        (e: any) => e.meet_link && e.meet_link.includes("meet.google.com"),
      );
      setEvents(meetOnly as MeetEvent[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!meetActive) { setLoading(false); return; }
    fetchEvents();
  }, [meetActive, fetchEvents]);

  // Auto-refresh every 60s
  useEffect(() => {
    if (!meetActive) return;
    const interval = setInterval(fetchEvents, 60_000);
    return () => clearInterval(interval);
  }, [meetActive, fetchEvents]);

  // Realtime
  useEffect(() => {
    if (!meetActive) return;
    const channel = supabase
      .channel("meet-dashboard")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "calendar_events",
      }, () => { fetchEvents(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [meetActive, fetchEvents]);

  if (!meetActive) return null;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const upcomingCount = events.filter((e) => isFuture(parseISO(e.start_time))).length;
  const todayCount = events.filter((e) => isToday(parseISO(e.start_time))).length;
  const thisMonthCount = events.filter((e) => {
    const d = parseISO(e.start_time);
    return d >= monthStart && d <= monthEnd;
  }).length;

  const visible = expanded ? events : events.slice(0, MAX_VISIBLE);
  const remaining = events.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.google_meet.icon} alt="Google Meet" className="w-5 h-5" />
          Sessions Google Meet
          {events.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {events.length}
            </span>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={async () => { setLoading(true); await fetchEvents(); }}
              title="Rafraîchir">
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
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
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {events.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="p-3 rounded-full bg-muted/50">
                  <Video className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Aucune session Meet à venir.
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Crée un événement avec Google Meet depuis le calendrier.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {visible.map((ev) => {
                  const isSoon =
                    differenceInMinutes(parseISO(ev.start_time), now) <= 15 &&
                    differenceInMinutes(parseISO(ev.start_time), now) >= 0;
                  return (
                    <div
                      key={ev.id}
                      className={`w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-2 rounded-md group ${
                        isSoon ? "bg-destructive/10 border border-destructive/20 animate-pulse" : ""
                      }`}
                    >
                      <div className={`p-1.5 rounded-md shrink-0 ${isSoon ? "bg-destructive/20" : "bg-muted/50"}`}>
                        {isSoon ? (
                          <AlertCircle className="w-4 h-4 text-destructive" />
                        ) : (
                          <img src={INTEGRATION_CONFIG.google_meet.icon} alt="" className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20"
                          >
                            <Video className="w-3 h-3" /> Meet
                          </Badge>
                          {isSoon && (
                            <span className="text-[10px] font-bold text-destructive bg-destructive/15 px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
                              Imminent
                            </span>
                          )}
                        </div>
                        <p className={`text-sm truncate mt-0.5 ${isSoon ? "text-destructive font-semibold" : "text-foreground"}`}>
                          {ev.title}
                        </p>
                        <p className={`text-xs flex items-center gap-1 mt-0.5 ${isSoon ? "text-destructive/80" : "text-muted-foreground"}`}>
                          <Clock className="w-3 h-3" />
                          {formatMeetDate(ev.start_time)}
                        </p>
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {isSoon && (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            style={{ backgroundColor: "#00897B", color: "#fff" }}
                            onClick={() => window.open(ev.meet_link, "_blank")}
                          >
                            <Video className="w-3.5 h-3.5" /> Rejoindre
                          </Button>
                        )}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => window.open(ev.meet_link, "_blank")}
                            className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                            title="Rejoindre"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(ev.meet_link);
                              toast.success("Lien copié ✅");
                            }}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                            title="Copier le lien"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
