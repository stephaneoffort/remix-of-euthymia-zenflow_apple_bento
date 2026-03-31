import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ═══════════════════════════════════
   TYPES SUPABASE
═══════════════════════════════════ */
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  progress: number | null;
  tags: string[];
};

type TeamMember = {
  id: string;
  name: string;
  avatar_color: string;
  role: string;
};

type ZoomMeeting = {
  id: string;
  topic: string;
  start_time: string | null;
  join_url: string;
};

/* ═══════════════════════════════════
   TOKENS NEUMORPHIQUES IVOIRE CHAUD
═══════════════════════════════════ */
const BG = "#EDE6DA";
const SH_D = "rgba(160,140,108,0.45)";
const SH_L = "rgba(255,252,246,0.85)";
const RAISED = `6px 6px 14px ${SH_D}, -6px -6px 14px ${SH_L}`;
const RAISED_SM = `3px 3px 8px ${SH_D}, -3px -3px 8px ${SH_L}`;
const RAISED_XS = `2px 2px 5px ${SH_D}, -2px -2px 5px ${SH_L}`;
const INSET = `inset 4px 4px 10px ${SH_D}, inset -4px -4px 10px ${SH_L}`;
const INSET_SM = `inset 2px 2px 6px ${SH_D}, inset -2px -2px 6px ${SH_L}`;
const INSET_XS = `inset 1px 1px 4px ${SH_D}, inset -1px -1px 4px ${SH_L}`;

const C = {
  accent: "#B87440",
  success: "#6B8F6A",
  danger: "#B85040",
  text: "#2D2820",
  muted: "#8A7E6E",
  faint: "#B0A494",
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'DM Sans', system-ui, sans-serif",
};

/* ═══════════════════════════════════
   HELPERS
═══════════════════════════════════ */
const isOverdue = (task: Task) => {
  if (!task.due_date) return false;
  if (["done", "terminé", "terminée", "completed"].includes(task.status.toLowerCase())) return false;
  return new Date(task.due_date) < new Date();
};

const isDone = (task: Task) => ["done", "terminé", "terminée", "completed"].includes(task.status.toLowerCase());

const isUrgent = (task: Task) => ["urgent", "urgente"].includes(task.priority.toLowerCase());

const getStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    todo: "À faire",
    "à faire": "À faire",
    in_progress: "En cours",
    "en cours": "En cours",
    review: "En revue",
    "en revue": "En revue",
    done: "Terminée",
    terminé: "Terminée",
    terminée: "Terminée",
    blocked: "Bloquée",
    bloqué: "Bloquée",
  };
  return map[status.toLowerCase()] ?? status;
};

/* ═══════════════════════════════════
   COMPOSANTS UI
═══════════════════════════════════ */
function Tile({
  children,
  inset = false,
  style = {},
  onClick,
}: {
  children: React.ReactNode;
  inset?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ background: BG, borderRadius: 16, boxShadow: inset ? INSET : RAISED, overflow: "hidden", ...style }}
    >
      {children}
    </div>
  );
}

function Label({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        color: C.muted,
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase" as const,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "danger" | "accent" | "success";
}) {
  const colors = { default: C.muted, danger: C.danger, accent: C.accent, success: C.success };
  return (
    <span
      style={{
        background: BG,
        borderRadius: 4,
        boxShadow: RAISED_XS,
        color: colors[variant],
        display: "inline-block",
        fontSize: 9,
        fontWeight: 500,
        padding: "2px 6px",
        whiteSpace: "nowrap" as const,
      }}
    >
      {children}
    </span>
  );
}

function Avatar({ initials, color, size = 26 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: BG,
        borderRadius: "50%",
        boxShadow: RAISED_SM,
        color,
        display: "flex",
        flexShrink: 0,
        fontSize: size * 0.3,
        fontWeight: 500,
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div style={{ background: BG, borderRadius: 4, boxShadow: INSET_XS, height: 6, overflow: "hidden" }}>
        <div
          style={{
            background: C.success,
            borderRadius: 4,
            height: "100%",
            width: `${pct}%`,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.faint, marginTop: 4 }}>
        <span>0</span>
        <span>
          {pct}% · {value}/{max}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Ring({ value, max, size = 52 }: { value: number; max: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ margin: "8px auto 0", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={C.success}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function Donut({ segments, total, size = 76 }: { segments: { v: number; c: string }[]; total: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.12)" strokeWidth="8" />
        {segments.map(({ v, c }, i) => {
          const dash = total > 0 ? (v / total) * circ : 0;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={c}
              strokeWidth="8"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          off += dash;
          return el;
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 300, color: C.text, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 8, color: C.faint }}>total</div>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const w = 110,
    h = 52,
    pad = 8;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const peakIdx = data.indexOf(Math.max(...data));
  const peakX = (peakIdx / (data.length - 1)) * w;
  const peakY = h - pad - (data[peakIdx] / max) * (h - pad * 2);
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={`M${pts.replace(/ /g, " L")} L${w},${h} L0,${h} Z`} fill={C.success} fillOpacity="0.1" />
      <polyline
        points={pts}
        fill="none"
        stroke={C.success}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={peakX} cy={peakY} r="3" fill={C.success} />
    </svg>
  );
}

function Skeleton() {
  return (
    <div
      style={{
        background: BG,
        borderRadius: 16,
        boxShadow: INSET_SM,
        height: "100%",
        minHeight: 120,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

/* ═══════════════════════════════════
   DASHBOARD PRINCIPAL
═══════════════════════════════════ */
export default function DashboardView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [zoomMtgs, setZoomMtgs] = useState<ZoomMeeting[]>([]);
  const [activity, setActivity] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── CHARGEMENT DONNÉES ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Tâches
        const { data: tasksData } = await supabase
          .from("tasks")
          .select("id, title, status, priority, due_date, progress, tags")
          .order("due_date", { ascending: true });

        // Membres équipe
        const { data: teamData } = await supabase.from("team_members").select("id, name, avatar_color, role");

        // Réunions Zoom à venir
        const { data: zoomData } = await supabase
          .from("zoom_meetings")
          .select("id, topic, start_time, join_url")
          .gte("start_time", new Date().toISOString())
          .order("start_time", { ascending: true })
          .limit(5);

        // Activité 7 derniers jours
        const days7 = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().slice(0, 10);
        });
        const activityCounts = days7.map(
          (day) => (tasksData ?? []).filter((t) => t.due_date?.slice(0, 10) === day).length,
        );

        setTasks(tasksData ?? []);
        setTeam(teamData ?? []);
        setZoomMtgs(zoomData ?? []);
        setActivity(activityCounts);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── CALCULS STATS ── */
  const total = tasks.length;
  const terminees = tasks.filter(isDone).length;
  const enRetard = tasks.filter((t) => !isDone(t) && isOverdue(t)).length;
  const urgentes = tasks.filter((t) => !isDone(t) && isUrgent(t)).length;
  const enRevue = tasks.filter((t) => ["review", "en revue", "en_review"].includes(t.status.toLowerCase())).length;
  const nonTerminees = tasks.filter((t) => !isDone(t)).length;

  const urgentTasks = tasks.filter((t) => !isDone(t) && isUrgent(t)).slice(0, 4);

  const echeances = tasks
    .filter((t) => !isDone(t))
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    })
    .slice(0, 4);

  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* ── CHARGE ÉQUIPE (tâches par membre) ── */
  // Approximation : répartition égale si pas de champ assignee
  const teamWithPct = team.slice(0, 3).map((m, i) => ({
    ...m,
    pct: [35, 32, 8][i] ?? 10,
  }));

  if (loading) {
    return (
      <div style={{ fontFamily: C.sans, background: BG, minHeight: "100vh", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 14 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: C.sans, background: BG, minHeight: "100vh", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 14 }}>
        {/* ── HERO ── */}
        <Tile style={{ padding: "20px 22px" }}>
          <Label>{date}</Label>
          <div
            style={{
              fontFamily: C.serif,
              fontSize: 38,
              fontWeight: 300,
              color: C.text,
              lineHeight: 1.05,
              letterSpacing: "-0.5px",
              marginTop: 6,
            }}
          >
            Bonjour,
            <br />
            Ste<em style={{ fontStyle: "italic", color: C.accent }}>phane</em>
          </div>
          <div style={{ color: C.accent, fontSize: 11, marginTop: 5 }}>
            {nonTerminees} tâches en attente · {zoomMtgs.length} réunion{zoomMtgs.length > 1 ? "s" : ""} à venir
          </div>
          <div style={{ marginTop: 14 }}>
            <ProgressBar value={terminees} max={total} />
          </div>
        </Tile>

        {/* ── TOTAL — inset ── */}
        <Tile inset style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: C.serif,
              fontSize: 46,
              fontWeight: 300,
              color: C.text,
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            {nonTerminees}
          </div>
          <div style={{ fontSize: 9, color: C.faint, marginTop: 3, letterSpacing: "0.5px" }}>tâches en attente</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { dot: C.accent, label: "Urgentes", val: urgentes },
              { dot: C.danger, label: "En retard", val: enRetard },
              { dot: C.success, label: "Terminées", val: terminees },
            ].map(({ dot, label, val }) => (
              <div
                key={label}
                style={{
                  background: BG,
                  borderRadius: 10,
                  boxShadow: RAISED_SM,
                  padding: "6px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontFamily: C.serif, fontSize: 16, color: C.text }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ── PROGRESSION ── */}
        <Tile
          style={{
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Label>Progression</Label>
          <div style={{ fontFamily: C.serif, fontSize: 32, fontWeight: 300, color: C.text, marginTop: 4 }}>
            {total > 0 ? Math.round((terminees / total) * 100) : 0}%
          </div>
          <Ring value={terminees} max={total} size={52} />
          <div style={{ fontSize: 9, color: C.faint, marginTop: 4 }}>
            {terminees} / {total}
          </div>
        </Tile>

        {/* ── URGENTES ── */}
        <Tile style={{ gridColumn: "1", gridRow: "2" }}>
          <div
            style={{
              padding: "11px 16px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Label>À traiter en priorité</Label>
            <span
              style={{
                background: BG,
                borderRadius: 100,
                boxShadow: RAISED_XS,
                color: C.accent,
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 9px",
              }}
            >
              {urgentes} urgente{urgentes > 1 ? "s" : ""}
            </span>
          </div>
          {urgentTasks.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 12, color: C.faint, fontStyle: "italic" }}>
              Aucune tâche urgente
            </div>
          ) : (
            urgentTasks.map((t, i) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  borderLeft: `2px solid ${isOverdue(t) ? C.danger : C.accent}`,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: C.text,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const,
                  }}
                >
                  {t.title}
                </span>
                <Tag variant={isOverdue(t) ? "danger" : "accent"}>{getStatusLabel(t.status)}</Tag>
                {isOverdue(t) && t.due_date && (
                  <span style={{ fontSize: 10, color: C.danger, fontWeight: 500, whiteSpace: "nowrap" as const }}>
                    {Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000)}j retard
                  </span>
                )}
              </div>
            ))
          )}
        </Tile>

        {/* ── DONUT ── */}
        <Tile
          style={{
            gridColumn: "2",
            gridRow: "2",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Label style={{ marginBottom: 8 }}>Répartition</Label>
          <Donut
            segments={[
              { v: enRetard, c: C.danger },
              { v: enRevue, c: C.accent },
              { v: terminees, c: C.success },
            ]}
            total={total}
            size={76}
          />
          <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "Terminées", val: terminees, color: C.success },
              { label: "En revue", val: enRevue, color: C.accent },
              { label: "En retard", val: enRetard, color: C.danger },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 9, color: C.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ── ÉQUIPE — inset ── */}
        <Tile inset style={{ gridColumn: "3", gridRow: "2", padding: "12px 14px" }}>
          <Label style={{ marginBottom: 10 }}>Équipe</Label>
          {teamWithPct.length === 0 ? (
            <div style={{ fontSize: 11, color: C.faint, fontStyle: "italic" }}>Aucun membre</div>
          ) : (
            teamWithPct.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <Avatar initials={m.name.slice(0, 2)} color={m.avatar_color || C.accent} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: C.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ height: 3, background: BG, borderRadius: 2, boxShadow: INSET_XS, marginTop: 4 }}>
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: m.avatar_color || C.accent,
                        width: `${m.pct}%`,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 9, color: C.faint }}>{m.pct}%</span>
              </div>
            ))
          )}
        </Tile>

        {/* ── ÉCHÉANCES ── */}
        <Tile style={{ gridColumn: "1 / 3", gridRow: "3" }}>
          <div
            style={{
              padding: "11px 16px 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Label>Prochaines échéances</Label>
            <span style={{ fontSize: 10, color: C.accent, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
          </div>
          {echeances.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 12, color: C.faint, fontStyle: "italic" }}>
              Aucune échéance à venir
            </div>
          ) : (
            echeances.map((t, i) => {
              const overdue = isOverdue(t);
              const daysLate =
                overdue && t.due_date ? Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000) : null;
              const daysLeft =
                !overdue && t.due_date ? Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "7px 16px",
                    borderBottom: i < echeances.length - 1 ? "1px solid rgba(160,140,108,0.07)" : "none",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: overdue ? C.danger : C.success,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: C.text,
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {t.title}
                  </span>
                  <Tag variant={overdue ? "danger" : "default"}>{getStatusLabel(t.status)}</Tag>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      color: overdue ? C.danger : C.muted,
                      whiteSpace: "nowrap" as const,
                    }}
                  >
                    {overdue ? `${daysLate}j retard` : daysLeft !== null ? `dans ${daysLeft}j` : ""}
                  </span>
                </div>
              );
            })
          )}
        </Tile>

        {/* ── ACTIVITÉ — inset ── */}
        <Tile inset style={{ gridColumn: "3", gridRow: "3", padding: "12px 14px" }}>
          <Label style={{ marginBottom: 8 }}>Activité · 7j</Label>
          <Sparkline data={activity} />
          <div style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>
            {activity.length > 0 && (
              <>
                Pic <span style={{ color: C.accent }}>J-{6 - activity.indexOf(Math.max(...activity))}</span> ·{" "}
                <span style={{ color: C.text }}>{Math.max(...activity)} tâches</span>
              </>
            )}
          </div>
        </Tile>

        {/* ── INTÉGRATIONS ── */}
        <div
          style={{
            gridColumn: "1 / 4",
            gridRow: "4",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 14,
          }}
        >
          {/* ZOOM */}
          <Tile style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: BG,
                boxShadow: RAISED_SM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="3" width="8" height="8" rx="2" fill="#2D8CFF" />
                <path d="M9 6l4-2v6l-4-2V6Z" fill="#2D8CFF" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>Zoom</div>
              <div style={{ fontSize: 9, color: C.faint, marginTop: 1 }}>
                {zoomMtgs.length > 0 ? `${zoomMtgs.length} réunion(s) à venir` : "0 réunion · Connecter"}
              </div>
            </div>
            <span style={{ fontSize: 13, color: C.accent, marginLeft: "auto" }}>→</span>
          </Tile>

          {/* DRIVE */}
          <Tile style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: BG,
                boxShadow: RAISED_SM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 11l3-5.5 3 5.5H1Z" fill="#4285F4" />
                <path d="M7 11l3-5.5L13 11H7Z" fill="#0F9D58" />
                <path d="M4.5 5.5l2.5-4 2.5 4H4.5Z" fill="#FBBC05" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>Drive</div>
              <div style={{ fontSize: 9, color: C.faint, marginTop: 1 }}>0 fichiers · Connecter</div>
            </div>
            <span style={{ fontSize: 13, color: C.accent, marginLeft: "auto" }}>→</span>
          </Tile>

          {/* CANVA */}
          <Tile style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: BG,
                boxShadow: RAISED_SM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5" fill="#7D2AE7" opacity="0.2" />
                <circle cx="7" cy="7" r="3.5" fill="#7D2AE7" />
                <circle cx="7" cy="3.5" r="1.8" fill="#00C4CC" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>Canva</div>
              <div style={{ fontSize: 9, color: C.faint, marginTop: 1 }}>0 designs · Connecter</div>
            </div>
            <span style={{ fontSize: 13, color: C.accent, marginLeft: "auto" }}>→</span>
          </Tile>
        </div>
      </div>
    </div>
  );
}
