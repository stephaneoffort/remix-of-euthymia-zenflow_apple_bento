import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useMemo } from "react";

/* ─── Design tokens ─── */
const BG = "#EDE6DA";
const raised = "6px 6px 14px rgba(160,140,108,0.45),-6px -6px 14px rgba(255,252,246,0.85)";
const inset = "inset 4px 4px 10px rgba(160,140,108,0.45),inset -4px -4px 10px rgba(255,252,246,0.85)";
const pill = "2px 2px 5px rgba(160,140,108,0.45),-2px -2px 5px rgba(255,252,246,0.85)";
const pillMd = "3px 3px 8px rgba(160,140,108,0.45),-3px -3px 8px rgba(255,252,246,0.85)";
const barIn = "inset 1px 1px 4px rgba(160,140,108,0.45),inset -1px -1px 4px rgba(255,252,246,0.85)";

const C = {
  text: "#2D2820",
  muted: "#8A7E6E",
  light: "#B0A494",
  orange: "#B87440",
  red: "#B85040",
  green: "#6B8F6A",
};

/* ─── Sub-components ─── */
const Lbl = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontWeight: 500 }}>
    {children}
  </div>
);

const Tile = ({
  children,
  nm = false,
  style,
}: {
  children: React.ReactNode;
  nm?: boolean;
  style?: React.CSSProperties;
}) => (
  <div style={{ background: BG, borderRadius: 14, boxShadow: nm ? inset : raised, overflow: "hidden", ...style }}>
    {children}
  </div>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span
    style={{
      background: BG,
      borderRadius: 4,
      boxShadow: pill,
      fontSize: 8,
      fontWeight: 500,
      padding: "1px 5px",
      color: C.muted,
    }}
  >
    {children}
  </span>
);

const Dot = ({ color }: { color: string }) => (
  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
);

/* ─── Main component ─── */
export default function DashboardViewNM() {
  const { tasks, members } = useAppContext();
  const { user } = useAuth();

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, []);

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Stephane";

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const total = all.length;
    const done = all.filter((t) => t.status === "done").length;
    const overdue = all.filter((t) => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date()).length;
    const urgent = all.filter((t) => t.priority === "high" && t.status !== "done").length;
    const inReview = all.filter((t) => t.status === "in_review").length;
    const pending = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const circ = 2 * Math.PI * 19;
    const offset = circ - (pct / 100) * circ;
    return { total, done, overdue, urgent, inReview, pending, pct, circ, offset };
  }, [tasks]);

  const urgentTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.priority === "high" && t.status !== "done").slice(0, 4),
    [tasks],
  );

  const deadlines = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.due_date)
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 4),
    [tasks],
  );

  const teamMembers = useMemo(() => (members ?? []).slice(0, 3), [members]);

  const daysLabel = (due?: string | null) => {
    if (!due) return "";
    const diff = Math.round((new Date(due).getTime() - Date.now()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)}j retard`;
    if (diff === 0) return "aujourd'hui";
    return `dans ${diff}j`;
  };

  const statusColor = (status?: string) => (status === "done" ? C.green : status === "in_review" ? C.orange : C.red);

  /* donut 70×70 r=26 */
  const r2 = 26,
    circ2 = 2 * Math.PI * r2;
  const doneArc = (stats.done / (stats.total || 1)) * circ2;
  const reviewArc = (stats.inReview / (stats.total || 1)) * circ2;
  const lateArc = (stats.overdue / (stats.total || 1)) * circ2;

  return (
    <div
      style={{ fontFamily: "'DM Sans', sans-serif", background: BG, padding: 14, borderRadius: 16, minHeight: "100%" }}
    >
      {/* ── Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 10 }}>
        {/* HERO */}
        <Tile style={{ padding: "18px 20px" }}>
          <Lbl>{today}</Lbl>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: 34,
              color: C.text,
              lineHeight: 1.05,
              marginTop: 4,
            }}
          >
            Bonjour,
            <br />
            <em style={{ color: C.orange, fontStyle: "italic" }}>{firstName}</em>
          </div>
          <div style={{ fontSize: 10, color: C.orange, marginTop: 4 }}>{stats.pending} tâches en attente</div>
          <div style={{ marginTop: 12 }}>
            <div style={{ height: 5, borderRadius: 3, background: BG, boxShadow: barIn, overflow: "hidden" }}>
              <div style={{ width: `${stats.pct}%`, height: "100%", background: C.green, borderRadius: 3 }} />
            </div>
            <div
              style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.light, marginTop: 3 }}
            >
              <span>0</span>
              <span>
                {stats.pct}% · {stats.done}/{stats.total}
              </span>
              <span>{stats.total}</span>
            </div>
          </div>
        </Tile>

        {/* TOTAL inset */}
        <Tile nm style={{ padding: 14, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: 42,
              color: C.text,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {stats.pending}
          </div>
          <div style={{ fontSize: 8, color: C.light, marginTop: 2, letterSpacing: 0.5 }}>tâches en attente</div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {[
              { label: "Urgentes", count: stats.urgent, color: C.orange },
              { label: "En retard", count: stats.overdue, color: C.red },
              { label: "Terminées", count: stats.done, color: C.green },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: BG,
                  borderRadius: 9,
                  boxShadow: pillMd,
                  padding: "5px 9px",
                }}
              >
                <Dot color={color} />
                <span style={{ fontSize: 9, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: C.text }}>{count}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* PROGRESSION */}
        <Tile
          style={{
            padding: "14px 10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Lbl>Progression</Lbl>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 300,
              fontSize: 28,
              color: C.text,
              marginTop: 3,
            }}
          >
            {stats.pct}%
          </div>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ margin: "8px auto 0", display: "block" }}>
            <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth="5" />
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="none"
              stroke={C.green}
              strokeWidth="5"
              strokeDasharray={stats.circ}
              strokeDashoffset={stats.offset}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
            />
          </svg>
          <div style={{ fontSize: 8, color: C.light, marginTop: 3 }}>
            {stats.done} / {stats.total}
          </div>
        </Tile>

        {/* URGENTES */}
        <Tile style={{ gridColumn: 1, gridRow: 2 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 14px 7px",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Lbl>À traiter</Lbl>
            <span
              style={{
                background: BG,
                borderRadius: 100,
                boxShadow: pill,
                fontSize: 9,
                fontWeight: 500,
                padding: "2px 8px",
                color: C.orange,
              }}
            >
              {stats.urgent} urgentes
            </span>
          </div>
          {urgentTasks.length === 0 ? (
            <div style={{ padding: "12px 14px", fontSize: 10, color: C.light }}>Aucune tâche urgente 🎉</div>
          ) : (
            urgentTasks.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 14px",
                  borderLeft: `2px solid ${statusColor(t.status)}`,
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: C.text,
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.title}
                </span>
                <Tag>{t.status}</Tag>
                <span style={{ fontSize: 9, color: C.red, fontWeight: 500 }}>{daysLabel(t.due_date)}</span>
              </div>
            ))
          )}
          {stats.urgent > 4 && (
            <div style={{ padding: "6px 14px", fontSize: 9, color: C.orange, cursor: "pointer" }}>
              + {stats.urgent - 4} autres urgentes →
            </div>
          )}
        </Tile>

        {/* DONUT */}
        <Tile
          style={{
            gridColumn: 2,
            gridRow: 2,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Lbl>Répartition</Lbl>
          <div style={{ position: "relative", width: 70, height: 70, marginTop: 7 }}>
            <svg width="70" height="70" viewBox="0 0 70 70">
              <circle cx="35" cy="35" r={r2} fill="none" stroke="rgba(160,140,108,0.12)" strokeWidth="8" />
              <circle
                cx="35"
                cy="35"
                r={r2}
                fill="none"
                stroke={C.green}
                strokeWidth="8"
                strokeDasharray={`${doneArc} ${circ2}`}
                strokeDashoffset={circ2 * 0.25}
                strokeLinecap="round"
              />
              <circle
                cx="35"
                cy="35"
                r={r2}
                fill="none"
                stroke={C.orange}
                strokeWidth="8"
                strokeDasharray={`${reviewArc} ${circ2}`}
                strokeDashoffset={circ2 * 0.25 - doneArc}
                strokeLinecap="round"
              />
              <circle
                cx="35"
                cy="35"
                r={r2}
                fill="none"
                stroke={C.red}
                strokeWidth="8"
                strokeDasharray={`${lateArc} ${circ2}`}
                strokeDashoffset={circ2 * 0.25 - doneArc - reviewArc}
                strokeLinecap="round"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 16,
                color: C.text,
              }}
            >
              {stats.total}
            </div>
          </div>
          <div style={{ marginTop: 9, width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { label: "Terminées", count: stats.done, color: C.green },
              { label: "En revue", count: stats.inReview, color: C.orange },
              { label: "En retard", count: stats.overdue, color: C.red },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Dot color={color} />
                <span style={{ fontSize: 8, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 8, color: C.text, fontWeight: 500 }}>{count}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ÉQUIPE inset */}
        <Tile nm style={{ gridColumn: 3, gridRow: 2, padding: "11px 12px" }}>
          <Lbl>Équipe</Lbl>
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 9 }}>
            {teamMembers.length === 0 ? (
              <div style={{ fontSize: 9, color: C.light }}>—</div>
            ) : (
              teamMembers.map((m, i) => {
                const initials = (m.full_name ?? m.email ?? "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const colors = [C.orange, C.red, C.muted];
                const pct = Math.round(30 - i * 5 + Math.random() * 10);
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: BG,
                        boxShadow: pillMd,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        fontWeight: 500,
                        color: colors[i],
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: C.text,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {m.full_name ?? m.email}
                      </div>
                      <div style={{ height: 2, background: BG, borderRadius: 1, boxShadow: barIn, marginTop: 3 }}>
                        <div style={{ height: 2, borderRadius: 1, background: colors[i], width: `${pct}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 8, color: C.light }}>{pct}%</span>
                  </div>
                );
              })
            )}
          </div>
        </Tile>

        {/* ÉCHÉANCES */}
        <Tile style={{ gridColumn: "1 / 3", gridRow: 3 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "9px 14px 7px",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Lbl>Prochaines échéances</Lbl>
            <span style={{ fontSize: 9, color: C.orange, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
          </div>
          {deadlines.map((t, i) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderBottom: i < deadlines.length - 1 ? "1px solid rgba(160,140,108,0.08)" : "none",
                cursor: "pointer",
              }}
            >
              <Dot color={statusColor(t.status)} />
              <span
                style={{
                  fontSize: 10,
                  color: C.text,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.title}
              </span>
              <Tag>{t.status}</Tag>
              <span style={{ fontSize: 9, color: statusColor(t.status), fontWeight: 500, whiteSpace: "nowrap" }}>
                {daysLabel(t.due_date)}
              </span>
            </div>
          ))}
          {deadlines.length === 0 && (
            <div style={{ padding: "12px 14px", fontSize: 10, color: C.light }}>Aucune échéance à venir</div>
          )}
        </Tile>

        {/* ACTIVITÉ inset */}
        <Tile nm style={{ gridColumn: 3, gridRow: 3, padding: "11px 12px" }}>
          <Lbl>Activité · 7j</Lbl>
          <svg width="100%" height="48" viewBox="0 0 110 48" preserveAspectRatio="none" style={{ marginTop: 7 }}>
            <path
              d="M0,40 L16,35 L32,20 L48,27 L64,10 L80,27 L96,19 L110,32 L110,48 L0,48 Z"
              fill={C.green}
              fillOpacity="0.1"
            />
            <polyline
              points="0,40 16,35 32,20 48,27 64,10 80,27 96,19 110,32"
              fill="none"
              stroke={C.green}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="64" cy="10" r="3" fill={C.green} />
          </svg>
          <div style={{ fontSize: 8, color: C.muted, marginTop: 4 }}>
            Pic <span style={{ color: C.orange }}>cette semaine</span> ·{" "}
            <span style={{ color: C.text }}>{stats.done} tâches</span>
          </div>
        </Tile>

        {/* INTÉGRATIONS */}
        <div
          style={{
            gridColumn: "1 / 4",
            gridRow: 4,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 10,
          }}
        >
          {[
            {
              name: "Zoom",
              sub: "0 réunions · Connecter",
              icon: (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="8" height="8" rx="2" fill="#2D8CFF" />
                  <path d="M9 6l4-2v6l-4-2V6Z" fill="#2D8CFF" />
                </svg>
              ),
            },
            {
              name: "Drive",
              sub: "0 fichiers · Connecter",
              icon: (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <path d="M1 11l3-5.5 3 5.5H1Z" fill="#4285F4" />
                  <path d="M7 11l3-5.5L13 11H7Z" fill="#0F9D58" />
                  <path d="M4.5 5.5l2.5-4 2.5 4H4.5Z" fill="#FBBC05" />
                </svg>
              ),
            },
            {
              name: "Canva",
              sub: "0 designs · Connecter",
              icon: (
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5" fill="#7D2AE7" opacity="0.2" />
                  <circle cx="7" cy="7" r="3.5" fill="#7D2AE7" />
                  <circle cx="7" cy="3.5" r="1.8" fill="#00C4CC" />
                </svg>
              ),
            },
          ].map(({ name, sub, icon }) => (
            <Tile
              key={name}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", cursor: "pointer" }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: BG,
                  boxShadow: pillMd,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {icon}
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.text, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 8, color: C.light, marginTop: 1 }}>{sub}</div>
              </div>
              <span style={{ fontSize: 12, color: C.orange, marginLeft: "auto" }}>→</span>
            </Tile>
          ))}
        </div>
      </div>
    </div>
  );
}
