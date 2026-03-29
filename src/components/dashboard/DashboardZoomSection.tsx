import React, { useEffect, useState } from "react";
import { useZoom, ZoomMeeting } from "@/hooks/useZoom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ExternalLink, Copy, Clock } from "lucide-react";
import { format, parseISO, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";

const MAX_VISIBLE = 5;

export default function DashboardZoomSection() {
  const { isActive } = useIntegrations();
  const zoom = useZoom();
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isActive('zoom')) { setLoading(false); return; }
    if (!zoom.isConnected) { setLoading(false); return; }
    (async () => {
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
    })();
  }, [zoom.isConnected, isActive('zoom')]);

  if (!isActive('zoom')) return null;

  const visible = expanded ? meetings : meetings.slice(0, MAX_VISIBLE);
  const remaining = meetings.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.zoom.icon} alt="Zoom" className="w-5 h-5" />
          Réunions Zoom
          {meetings.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
              {meetings.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
        ) : meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune réunion à venir</p>
        ) : (
          <div className="space-y-1">
            {visible.map((m) => (
              <div
                key={m.id}
                className="w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md group"
              >
                <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                  <img src={INTEGRATION_CONFIG.zoom.icon} alt="" className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground truncate">{m.topic}</p>
                  {m.start_time && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(parseISO(m.start_time), "d MMM · HH:mm", { locale: fr })}
                      {m.duration > 0 && ` · ${m.duration} min`}
                    </p>
                  )}
                </div>
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
