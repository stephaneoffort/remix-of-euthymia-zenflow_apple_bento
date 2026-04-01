import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useIsMobile } from "@/hooks/use-mobile";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

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
  <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: C.muted, fontWeight: 500 }}>
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
      fontSize: 11,
      fontWeight: 500,
      padding: "2px 7px",
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
  const { tasks, teamMembers: members, setSelectedTaskId } = useApp();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, []);

  const rawFirst = user?.user_metadata?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Utilisateur";
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase();

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const total = all.length;
    const done = all.filter((t) => t.status === "done").length;
    const overdue = all.filter((t) => t.status !== "done" && t.dueDate && new Date(t.dueDate) < new Date()).length;
    const urgent = all.filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "done").length;
    const inReview = all.filter((t) => t.status === "in_review").length;
    const pending = total - done;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const circ = 2 * Math.PI * 19;
    const offset = circ - (pct / 100) * circ;
    return { total, done, overdue, urgent, inReview, pending, pct, circ, offset };
  }, [tasks]);

  const urgentTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "done")
        .slice(0, 4),
    [tasks],
  );

  const deadlines = useMemo(() => {
    const now = new Date();
    return (tasks ?? [])
      .filter((t) => t.dueDate && t.status !== "done" && new Date(t.dueDate) >= now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 4);
  }, [tasks]);

  const teamMembers = useMemo(() => (members ?? []).slice(0, 5), [members]);

  const memberCompletion = useMemo(() => {
    const all = tasks ?? [];
    const map: Record<string, { total: number; done: number }> = {};
    for (const t of all) {
      for (const mid of t.assigneeIds ?? []) {
        if (!map[mid]) map[mid] = { total: 0, done: 0 };
        map[mid].total++;
        if (t.status === "done") map[mid].done++;
      }
    }
    return map;
  }, [tasks]);

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

  /* ─── MOBILE LAYOUT ─── */
  if (isMobile) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: BG, padding: 12, minHeight: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* HERO */}
          <Tile style={{ padding: "16px 18px" }}>
            <Lbl>{today}</Lbl>
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 300,
                fontSize: 28,
                color: C.text,
                lineHeight: 1.05,
                marginTop: 4,
              }}
            >
              Bonjour, <em style={{ color: C.orange, fontStyle: "italic" }}>{firstName}</em>
            </div>
            <div style={{ fontSize: 13, color: C.orange, marginTop: 4 }}>{stats.pending} tâches en attente</div>
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 5, borderRadius: 3, background: BG, boxShadow: barIn, overflow: "hidden" }}>
                <div style={{ width: `${stats.pct}%`, height: "100%", background: C.green, borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.light, marginTop: 3 }}>
                <span>0</span>
                <span>{stats.pct}% · {stats.done}/{stats.total}</span>
                <span>{stats.total}</span>
              </div>
            </div>
          </Tile>

          {/* STATS ROW */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* TOTAL */}
            <Tile nm style={{ padding: 14 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 36, color: C.text, lineHeight: 1 }}>
                {stats.pending}
              </div>
              <div style={{ fontSize: 11, color: C.light, marginTop: 2 }}>en attente</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { label: "Urgentes", count: stats.urgent, color: C.orange },
                  { label: "En retard", count: stats.overdue, color: C.red },
                  { label: "Terminées", count: stats.done, color: C.green },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Dot color={color} />
                    <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{count}</span>
                  </div>
                ))}
              </div>
            </Tile>

            {/* PROGRESSION */}
            <Tile style={{ padding: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <Lbl>Progression</Lbl>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 24, color: C.text, marginTop: 3 }}>
                {stats.pct}%
              </div>
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ margin: "6px auto 0" }}>
                <circle cx="24" cy="24" r="19" fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth="5" />
                <circle cx="24" cy="24" r="19" fill="none" stroke={C.green} strokeWidth="5"
                  strokeDasharray={stats.circ} strokeDashoffset={stats.offset}
                  strokeLinecap="round" transform="rotate(-90 24 24)" />
              </svg>
              <div style={{ fontSize: 11, color: C.light, marginTop: 3 }}>{stats.done} / {stats.total}</div>
            </Tile>
          </div>

          {/* URGENTES */}
          <Tile>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px 7px", borderBottom: "1px solid rgba(160,140,108,0.1)" }}>
              <Lbl>À traiter</Lbl>
              <span style={{ background: BG, borderRadius: 100, boxShadow: pill, fontSize: 12, fontWeight: 500, padding: "3px 10px", color: C.orange }}>
                {stats.urgent} urgentes
              </span>
            </div>
            {urgentTasks.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 13, color: C.light }}>Aucune tâche urgente 🎉</div>
            ) : (
              urgentTasks.map((t) => (
                <div key={t.id} onClick={() => setSelectedTaskId(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderLeft: `2px solid ${statusColor(t.status)}`, cursor: "pointer" }}>
                  <span style={{ fontSize: 14, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                   <span style={{ fontSize: 12, color: C.red, fontWeight: 500 }}>{daysLabel(t.dueDate)}</span>
                </div>
              ))
            )}
          </Tile>

          {/* ÉCHÉANCES */}
          <Tile>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px 7px", borderBottom: "1px solid rgba(160,140,108,0.1)" }}>
              <Lbl>Prochaines échéances</Lbl>
            </div>
            {deadlines.length === 0 ? (
              <div style={{ padding: "12px 14px", fontSize: 13, color: C.light }}>Aucune échéance à venir</div>
            ) : (
              deadlines.map((t, i) => (
                <div key={t.id} onClick={() => setSelectedTaskId(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderBottom: i < deadlines.length - 1 ? "1px solid rgba(160,140,108,0.08)" : "none", cursor: "pointer" }}>
                  <Dot color={statusColor(t.status)} />
                   <span style={{ fontSize: 14, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                   <span style={{ fontSize: 12, color: statusColor(t.status), fontWeight: 500, whiteSpace: "nowrap" }}>{daysLabel(t.dueDate)}</span>
                </div>
              ))
            )}
          </Tile>

          {/* ÉQUIPE */}
          <Tile nm style={{ padding: "11px 14px" }}>
            <Lbl>Équipe</Lbl>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {teamMembers.length === 0 ? (
                 <div style={{ fontSize: 12, color: C.light }}>—</div>
              ) : (
                teamMembers.map((m, i) => {
                  const initials = (m.name ?? m.email ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                  const colors = [C.orange, C.red, C.muted, C.green, C.light];
                  const mc = memberCompletion[m.id];
                  const pct = mc && mc.total > 0 ? Math.round((mc.done / mc.total) * 100) : 0;
                  const taskLabel = mc ? `${mc.done}/${mc.total}` : "0/0";
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: BG, boxShadow: pillMd, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, color: colors[i], flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name ?? m.email}</div>
                        <div style={{ height: 3, background: BG, borderRadius: 2, boxShadow: barIn, marginTop: 3 }}>
                          <div style={{ height: 3, borderRadius: 2, background: colors[i], width: `${pct}%` }} />
                        </div>
                      </div>
                      <span style={{ fontSize: 12, color: C.light, whiteSpace: "nowrap" }}>{taskLabel} · {pct}%</span>
                    </div>
                  );
                })
              )}
            </div>
          </Tile>

          {/* INTÉGRATIONS */}
          <NMIntegrations isMobile />
        </div>
      </div>
    );
  }

  /* ─── DESKTOP LAYOUT ─── */
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
          <div style={{ fontSize: 13, color: C.orange, marginTop: 4 }}>{stats.pending} tâches en attente</div>
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
                onClick={() => setSelectedTaskId(t.id)}
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
                <span style={{ fontSize: 9, color: C.red, fontWeight: 500 }}>{daysLabel(t.dueDate)}</span>
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
              <circle cx="35" cy="35" r={r2} fill="none" stroke={C.green} strokeWidth="8"
                strokeDasharray={`${doneArc} ${circ2}`} strokeDashoffset={circ2 * 0.25} strokeLinecap="round" />
              <circle cx="35" cy="35" r={r2} fill="none" stroke={C.orange} strokeWidth="8"
                strokeDasharray={`${reviewArc} ${circ2}`} strokeDashoffset={circ2 * 0.25 - doneArc} strokeLinecap="round" />
              <circle cx="35" cy="35" r={r2} fill="none" stroke={C.red} strokeWidth="8"
                strokeDasharray={`${lateArc} ${circ2}`} strokeDashoffset={circ2 * 0.25 - doneArc - reviewArc} strokeLinecap="round" />
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
                const initials = (m.name ?? m.email ?? "?")
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const colors = [C.orange, C.red, C.muted, C.green, C.light];
                const mc = memberCompletion[m.id];
                const pct = mc && mc.total > 0 ? Math.round((mc.done / mc.total) * 100) : 0;
                const taskLabel = mc ? `${mc.done}/${mc.total}` : "0/0";
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
                        {m.name ?? m.email}
                      </div>
                      <div style={{ height: 2, background: BG, borderRadius: 1, boxShadow: barIn, marginTop: 3 }}>
                        <div style={{ height: 2, borderRadius: 1, background: colors[i], width: `${pct}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 8, color: C.light, whiteSpace: "nowrap" }}>{taskLabel} · {pct}%</span>
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
              onClick={() => setSelectedTaskId(t.id)}
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
                {daysLabel(t.dueDate)}
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
          {(() => {
            const all = tasks ?? [];
            const now = new Date();
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(now);
              d.setDate(d.getDate() - (6 - i));
              d.setHours(0, 0, 0, 0);
              return d;
            });
            const counts = days.map((d) => {
              const next = new Date(d);
              next.setDate(next.getDate() + 1);
              return all.filter((t) => {
                const u = new Date(t.createdAt);
                return u >= d && u < next;
              }).length;
            });
            const max = Math.max(...counts, 1);
            const h = 42;
            const w = 110;
            const step = w / (counts.length - 1);
            const pts = counts.map((c, i) => `${i * step},${h - (c / max) * (h - 6)}`).join(" ");
            const areaD = `M0,${h - (counts[0] / max) * (h - 6)} ` +
              counts.map((c, i) => `L${i * step},${h - (c / max) * (h - 6)}`).join(" ") +
              ` L${w},${h} L0,${h} Z`;
            const peakIdx = counts.indexOf(Math.max(...counts));
            const peakX = peakIdx * step;
            const peakY = h - (counts[peakIdx] / max) * (h - 6);
            const weekTotal = counts.reduce((a, b) => a + b, 0);
            const dayLabels = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
            const peakDay = dayLabels[days[peakIdx].getDay()];
            return (
              <>
                <svg width="100%" height="48" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ marginTop: 7 }}>
                  <path d={areaD} fill={C.green} fillOpacity="0.1" />
                  <polyline points={pts} fill="none" stroke={C.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx={peakX} cy={peakY} r="3" fill={C.green} />
                </svg>
                <div style={{ fontSize: 8, color: C.muted, marginTop: 4 }}>
                  Pic <span style={{ color: C.orange }}>{peakDay}</span> ({counts[peakIdx]}) · <span style={{ color: C.text }}>{weekTotal} actions</span>
                </div>
              </>
            );
          })()}
        </Tile>

        {/* INTÉGRATIONS */}
        <NMIntegrations />
      </div>
    </div>
  );
}

/* ─── NM Integrations sub-component ─── */
function NMIntegrations({ isMobile: isMobileProp }: { isMobile?: boolean } = {}) {
  const { isActive } = useIntegrations();
  const [zoomCount, setZoomCount] = useState(0);
  const [meetEvents, setMeetEvents] = useState<{ id: string; title: string; start_time: string; meet_link: string }[]>([]);
  const [zoomMeetings, setZoomMeetings] = useState<{ id: string; topic: string; start_time: string | null; join_url: string }[]>([]);
  const [driveCount, setDriveCount] = useState(0);
  const [canvaCount, setCanvaCount] = useState(0);
  const [brevoCount, setBrevoCount] = useState(0);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (isActive("zoom")) {
      const { data } = await supabase
        .from("zoom_meetings")
        .select("id, topic, start_time, join_url")
        .eq("user_id", user.id)
        .neq("status", "ended")
        .order("start_time", { ascending: true })
        .limit(5);
      setZoomMeetings(data ?? []);
      setZoomCount((data ?? []).length);
    }

    if (isActive("google_meet")) {
      const { data } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, meet_link")
        .eq("has_meet", true)
        .not("meet_link", "is", null)
        .gte("start_time", new Date().toISOString())
        .order("start_time", { ascending: true })
        .limit(5);
      const meetOnly = (data ?? []).filter((e: any) => e.meet_link?.includes("meet.google.com"));
      setMeetEvents(meetOnly);
    }

    if (isActive("google_drive")) {
      const { count } = await supabase
        .from("drive_attachments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setDriveCount(count ?? 0);
    }

    if (isActive("canva")) {
      const { count } = await supabase
        .from("canva_attachments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setCanvaCount(count ?? 0);
    }

    if (isActive("brevo")) {
      const { count } = await supabase
        .from("brevo_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setBrevoCount(count ?? 0);
    }
  }, [isActive]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    const d = parseISO(s);
    if (isToday(d)) return `Auj. ${format(d, "HH'h'mm")}`;
    if (isTomorrow(d)) return `Dem. ${format(d, "HH'h'mm")}`;
    return format(d, "d MMM HH'h'mm", { locale: fr });
  };

  const integrations = [
    {
      key: "zoom",
      active: isActive("zoom"),
      name: "Zoom",
      color: "#2D8CFF",
      count: zoomCount,
      unit: "réunion",
      items: zoomMeetings.map((m) => ({ label: m.topic, sub: fmtDate(m.start_time), url: m.join_url })),
    },
    {
      key: "meet",
      active: isActive("google_meet"),
      name: "Meet",
      color: "#00832D",
      count: meetEvents.length,
      unit: "réunion",
      items: meetEvents.map((e) => ({ label: e.title, sub: fmtDate(e.start_time), url: e.meet_link })),
    },
    {
      key: "drive",
      active: isActive("google_drive"),
      name: "Drive",
      color: "#4285F4",
      count: driveCount,
      unit: "fichier",
      items: [],
    },
    {
      key: "canva",
      active: isActive("canva"),
      name: "Canva",
      color: "#7D2AE7",
      count: canvaCount,
      unit: "design",
      items: [],
    },
    {
      key: "brevo",
      active: isActive("brevo"),
      name: "Brevo",
      color: "#0B996E",
      count: brevoCount,
      unit: "campagne",
      items: [],
    },
  ].filter((i) => i.active);

  if (integrations.length === 0) return null;

  const cols = isMobileProp ? Math.min(integrations.length, 2) : Math.min(integrations.length, 4);

  return (
    <div style={{
      ...(isMobileProp ? {} : { gridColumn: "1 / 4", gridRow: 4 }),
      display: "grid",
      gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
      gap: 10,
    }}>
      {integrations.map(({ key, name, color, count, unit, items }) => (
        <Tile key={key} style={{ padding: "10px 13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div
              style={{
                width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0,
                boxShadow: `0 0 6px ${color}44`,
              }}
            />
            <span style={{ fontSize: 9, fontWeight: 600, color: C.text, letterSpacing: 0.3 }}>{name}</span>
            <span style={{
              marginLeft: "auto",
              fontSize: 8,
              fontWeight: 500,
              color: C.muted,
              background: BG,
              borderRadius: 4,
              boxShadow: pill,
              padding: "1px 6px",
            }}>
              {count} {unit}{count > 1 ? "s" : ""}
            </span>
          </div>
          {items.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.slice(0, 3).map((item, i) => (
                <a
                  key={i}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 0",
                    textDecoration: "none",
                    borderBottom: i < Math.min(items.length, 3) - 1 ? "1px solid rgba(160,140,108,0.08)" : "none",
                  }}
                >
                  <span style={{ fontSize: 9, color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 8, color: C.light, whiteSpace: "nowrap" }}>{item.sub}</span>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 8, color: C.light }}>{count > 0 ? `${count} élément${count > 1 ? "s" : ""} liés` : "Connecté"}</div>
          )}
        </Tile>
      ))}
    </div>
  );
}
