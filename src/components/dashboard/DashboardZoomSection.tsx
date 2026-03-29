import React, { useEffect, useState } from "react";
import { useZoom, ZoomMeeting } from "@/hooks/useZoom";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, Video, ExternalLink, Copy, Clock } from "lucide-react";
import { format, parseISO, isFuture } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { useIntegrations } from "@/hooks/useIntegrations";

const VISIBLE_COUNT = 5;

export default function DashboardZoomSection() {
  const { isActive } = useIntegrations();
  const zoom = useZoom();
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isActive('zoom') || !zoom.isConnected) { setLoading(false); return; }
    (async () => {
      try {
        // List all meetings for "project" entity type with empty id to get all
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
  }, [zoom.isConnected]);

  if (!isActive('zoom')) return null;
  if (!zoom.isConnected && !loading) return null;

  const visibleMeetings = expanded ? meetings : meetings.slice(0, VISIBLE_COUNT);
  const remaining = meetings.length - VISIBLE_COUNT;

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="w-full flex items-center justify-between group cursor-pointer mb-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Video className="w-4 h-4 text-blue-500" />
          Réunions Zoom
          {meetings.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {meetings.length}
            </span>
          )}
        </h2>
        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        {loading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Chargement…</div>
        ) : meetings.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Aucune réunion à venir</div>
        ) : (
          <div className="space-y-2">
            {visibleMeetings.map((m) => (
              <Card key={m.id} className="bg-card border-border">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
                    <Video className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{m.topic}</p>
                    {m.start_time && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(m.start_time), "d MMM · HH:mm", { locale: fr })}
                        {m.duration > 0 && ` · ${m.duration} min`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
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
                </CardContent>
              </Card>
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
      </CollapsibleContent>
    </Collapsible>
  );
}
