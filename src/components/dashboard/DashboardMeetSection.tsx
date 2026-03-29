import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, Clock, ExternalLink, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";

interface MeetEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  meet_link: string;
}

const MAX_VISIBLE = 5;

export default function DashboardMeetSection() {
  const { isActive } = useIntegrations();
  const [events, setEvents] = useState<MeetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const meetActive = isActive('google_meet');

  useEffect(() => {
    if (!meetActive) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from('calendar_events')
          .select('id, title, start_time, end_time, meet_link')
          .eq('has_meet', true)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(20);
        setEvents((data as MeetEvent[]) ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [meetActive]);

  if (!meetActive) return null;

  const visible = expanded ? events : events.slice(0, MAX_VISIBLE);
  const remaining = events.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.google_meet.icon} alt="Google Meet" className="w-5 h-5" />
          Sessions Google Meet
          {events.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
              {events.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune session Meet à venir</p>
        ) : (
          <div className="space-y-1">
            {visible.map((ev) => (
              <div
                key={ev.id}
                className="w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md group"
              >
                <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                  <img src={INTEGRATION_CONFIG.google_meet.icon} alt="" className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(ev.start_time), "d MMM · HH:mm", { locale: fr })}
                  </p>
                </div>
                {ev.meet_link && (
                  <button
                    onClick={() => window.open(ev.meet_link, "_blank")}
                    className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                    title="Rejoindre"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
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
  );
}
