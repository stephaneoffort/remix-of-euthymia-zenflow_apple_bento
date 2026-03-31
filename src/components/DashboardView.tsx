import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ─── COULEURS ─────────────────────────────────────────── */
const BG = "#EDE6DA";
const SHD = "rgba(160,140,108,0.45)";
const SHL = "rgba(255,252,246,0.85)";
const UP = `6px 6px 14px ${SHD},-6px -6px 14px ${SHL}`;
const UP_SM = `3px 3px 8px ${SHD},-3px -3px 8px ${SHL}`;
const UP_XS = `2px 2px 5px ${SHD},-2px -2px 5px ${SHL}`;
const DN = `inset 4px 4px 10px ${SHD},inset -4px -4px 10px ${SHL}`;
const DN_XS = `inset 1px 1px 4px ${SHD},inset -1px -1px 4px ${SHL}`;
const SERIF = "'Cormorant Garamond',Georgia,serif";
const SANS = "'DM Sans',system-ui,sans-serif";
const ACCENT = "#B87440";
const SUCCESS = "#6B8F6A";
const DANGER = "#B85040";
const TEXT = "#2D2820";
const MUTED = "#8A7E6E";
const FAINT = "#B0A494";

/* ─── TYPES ────────────────────────────────────────────── */
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  tags: string[];
};
type Member = { id: string; name: string; avatar_color: string };

/* ─── HELPERS ──────────────────────────────────────────── */
const done = (t: Task) => ["done", "terminé", "terminée", "completed"].includes(t.status.toLowerCase());
const overdue = (t: Task) => !done(t) && !!t.due_date && new Date(t.due_date) < new Date();
const urgent = (t: Task) => ["urgent", "urgente", "high", "haute"].includes(t.priority.toLowerCase());
const daysLate = (t: Task) => (t.due_date ? Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000) : 0);
const daysLeft = (t: Task) =>
  t.due_date ? Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;

/* ─── COMPOSANTS DE BASE ───────────────────────────────── */
function Tile({
  ch,
  inset = false,
  s = {},
  onClick,
}: {
  ch: React.ReactNode;
  inset?: boolean;
  s?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{ background: BG, borderRadius: 16, boxShadow: inset ? DN : UP, overflow: "hidden", ...s }}
    >
      {ch}
    </div>
  );
}
function Lbl({ ch, s = {} }: { ch: React.ReactNode; s?: React.CSSProperties }) {
  return (
    <div
      style={{
        color: MUTED,
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase" as const,
        ...s,
      }}
    >
      {ch}
    </div>
  );
}
function Tag({ ch, color = MUTED }: { ch: string; color?: string }) {
  return (
    <span
      style={{
        background: BG,
        borderRadius: 4,
        boxShadow: UP_XS,
        color,
        fontSize: 9,
        fontWeight: 500,
        padding: "2px 6px",
        whiteSpace: "nowrap" as const,
      }}
    >
      {ch}
    </span>
  );
}
function Dot({ color }: { color: string }) {
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}
function Row({ ch, s = {} }: { ch: React.ReactNode; s?: React.CSSProperties }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, ...s }}>{ch}</div>;
}

/* ─── DASHBOARD ────────────────────────────────────────── */
export default function DashboardView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase.from("tasks").select("id,title,status,priority,due_date,tags").order("due_date", { ascending: true }),
        supabase.from("team_members").select("id,name,avatar_color"),
      ]);
      setTasks(t ?? []);
      setTeam(m ?? []);
      setLoading(false);
    })();
  }, []);

  const total = tasks.length;
  const nDone = tasks.filter(done).length;
  const nUrgent = tasks.filter((t) => !done(t) && urgent(t)).length;
  const nLate = tasks.filter(overdue).length;
  const nPending = total - nDone;
  const pct = total > 0 ? Math.round((nDone / total) * 100) : 0;
  const urgentList = tasks.filter((t) => !done(t) && urgent(t)).slice(0, 4);
  const upcoming = tasks.filter((t) => !done(t)).slice(0, 4);
  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* Activité 7j */
  const days7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const activity = days7.map((d) => tasks.filter((t) => t.due_date?.slice(0, 10) === d).length);
  const peakVal = Math.max(...activity, 1);

  if (loading)
    return (
      <div
        style={{
          fontFamily: SANS,
          background: BG,
          minHeight: "100vh",
          padding: 20,
          display: "grid",
          gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)",
          gap: 14,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ background: BG, borderRadius: 16, boxShadow: DN, minHeight: 120 }} />
        ))}
      </div>
    );

  return (
    <div style={{ fontFamily: SANS, background: BG, minHeight: "100vh", padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;1,300&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');`}</style>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 14 }}>
        {/* HERO */}
        <Tile
          s={{ padding: "20px 22px" }}
          ch={
            <>
              <Lbl ch={date} />
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 38,
                  fontWeight: 300,
                  color: TEXT,
                  lineHeight: 1.05,
                  letterSpacing: "-0.5px",
                  marginTop: 6,
                }}
              >
                Bonjour,
                <br />
                <em style={{ fontStyle: "italic", color: ACCENT }}>Stephane</em>
              </div>
              <div style={{ color: ACCENT, fontSize: 11, marginTop: 5 }}>{nPending} tâches en attente</div>
              <div style={{ marginTop: 14 }}>
                <div style={{ background: BG, borderRadius: 4, boxShadow: DN_XS, height: 6, overflow: "hidden" }}>
                  <div
                    style={{
                      background: SUCCESS,
                      height: "100%",
                      width: `${pct}%`,
                      borderRadius: 4,
                      transition: "width .6s ease",
                    }}
                  />
                </div>
                <Row
                  s={{ justifyContent: "space-between", fontSize: 9, color: FAINT, marginTop: 4 }}
                  ch={
                    <>
                      <span>0</span>
                      <span>
                        {pct}% · {nDone}/{total}
                      </span>
                      <span>{total}</span>
                    </>
                  }
                />
              </div>
            </>
          }
        />

        {/* TOTAL inset */}
        <Tile
          inset
          s={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}
          ch={
            <>
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 46,
                  fontWeight: 300,
                  color: TEXT,
                  letterSpacing: "-2px",
                  lineHeight: 1,
                }}
              >
                {nPending}
              </div>
              <div style={{ fontSize: 9, color: FAINT, marginTop: 3, letterSpacing: "0.5px" }}>tâches en attente</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { dot: ACCENT, lbl: "Urgentes", val: nUrgent },
                  { dot: DANGER, lbl: "En retard", val: nLate },
                  { dot: SUCCESS, lbl: "Terminées", val: nDone },
                ].map(({ dot, lbl, val }) => (
                  <Row
                    key={lbl}
                    s={{ background: BG, borderRadius: 10, boxShadow: UP_SM, padding: "6px 10px" }}
                    ch={
                      <>
                        <Dot color={dot} />
                        <span style={{ fontSize: 10, color: MUTED, flex: 1 }}>{lbl}</span>
                        <span style={{ fontFamily: SERIF, fontSize: 16, color: TEXT }}>{val}</span>
                      </>
                    }
                  />
                ))}
              </div>
            </>
          }
        />

        {/* PROGRESSION */}
        <Tile
          s={{
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
          ch={
            <>
              <Lbl ch="Progression" />
              <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 300, color: TEXT, marginTop: 4 }}>{pct}%</div>
              <svg width={52} height={52} viewBox="0 0 52 52" style={{ margin: "8px auto 0", display: "block" }}>
                <circle cx={26} cy={26} r={21} fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth={5} />
                <circle
                  cx={26}
                  cy={26}
                  r={21}
                  fill="none"
                  stroke={SUCCESS}
                  strokeWidth={5}
                  strokeDasharray={2 * Math.PI * 21}
                  strokeDashoffset={2 * Math.PI * 21 * (1 - pct / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 26 26)"
                />
              </svg>
              <div style={{ fontSize: 9, color: FAINT, marginTop: 4 }}>
                {nDone} / {total}
              </div>
            </>
          }
        />

        {/* URGENTES */}
        <Tile
          s={{ gridColumn: "1", gridRow: "2" }}
          ch={
            <>
              <Row
                s={{
                  padding: "11px 16px 8px",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(160,140,108,0.1)",
                }}
                ch={
                  <>
                    <Lbl ch="À traiter" />
                    <span
                      style={{
                        background: BG,
                        borderRadius: 100,
                        boxShadow: UP_XS,
                        color: ACCENT,
                        fontSize: 10,
                        fontWeight: 500,
                        padding: "3px 9px",
                      }}
                    >
                      {nUrgent} urgente{nUrgent > 1 ? "s" : ""}
                    </span>
                  </>
                }
              />
              {urgentList.length === 0 ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: FAINT, fontStyle: "italic" }}>
                  Aucune tâche urgente 🎉
                </div>
              ) : (
                urgentList.map((t) => (
                  <Row
                    key={t.id}
                    s={{ padding: "7px 16px", borderLeft: `2px solid ${overdue(t) ? DANGER : ACCENT}`, gap: 8 }}
                    ch={
                      <>
                        <span
                          style={{
                            fontSize: 11,
                            color: TEXT,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {t.title}
                        </span>
                        <Tag ch={t.status} color={overdue(t) ? DANGER : ACCENT} />
                        {overdue(t) && (
                          <span style={{ fontSize: 10, color: DANGER, fontWeight: 500 }}>{daysLate(t)}j retard</span>
                        )}
                      </>
                    }
                  />
                ))
              )}
            </>
          }
        />

        {/* DONUT */}
        <Tile
          s={{
            gridColumn: "2",
            gridRow: "2",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
          ch={
            <>
              <Lbl ch="Répartition" s={{ marginBottom: 8 }} />
              {(() => {
                const segs = [
                  { v: nLate, c: DANGER },
                  { v: Math.round(total * 0.1), c: ACCENT },
                  { v: nDone, c: SUCCESS },
                ];
                const r = 30,
                  circ = 2 * Math.PI * r;
                let off = 0;
                return (
                  <div style={{ position: "relative", width: 72, height: 72 }}>
                    <svg width={72} height={72} viewBox="0 0 72 72">
                      <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(160,140,108,0.12)" strokeWidth={8} />
                      {segs.map(({ v, c }, i) => {
                        const d = total > 0 ? (v / total) * circ : 0;
                        const el = (
                          <circle
                            key={i}
                            cx={36}
                            cy={36}
                            r={r}
                            fill="none"
                            stroke={c}
                            strokeWidth={8}
                            strokeDasharray={`${d} ${circ - d}`}
                            strokeDashoffset={-off}
                            transform="rotate(-90 36 36)"
                          />
                        );
                        off += d;
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
                      <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 300, color: TEXT, lineHeight: 1 }}>
                        {total}
                      </div>
                      <div style={{ fontSize: 8, color: FAINT }}>total</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                {[
                  { lbl: "Terminées", val: nDone, c: SUCCESS },
                  { lbl: "En retard", val: nLate, c: DANGER },
                ].map(({ lbl, val, c }) => (
                  <Row
                    key={lbl}
                    ch={
                      <>
                        <Dot color={c} />
                        <span style={{ fontSize: 9, color: MUTED, flex: 1 }}>{lbl}</span>
                        <span style={{ fontSize: 9, color: TEXT, fontWeight: 500 }}>{val}</span>
                      </>
                    }
                  />
                ))}
              </div>
            </>
          }
        />

        {/* ÉQUIPE inset */}
        <Tile
          inset
          s={{ gridColumn: "3", gridRow: "2", padding: "12px 14px" }}
          ch={
            <>
              <Lbl ch="Équipe" s={{ marginBottom: 10 }} />
              {team.slice(0, 3).map((m, i) => (
                <Row
                  key={m.id}
                  s={{ marginBottom: 10, gap: 7 }}
                  ch={
                    <>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: BG,
                          boxShadow: UP_SM,
                          color: m.avatar_color || ACCENT,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 9,
                          fontWeight: 500,
                          flexShrink: 0,
                        }}
                      >
                        {m.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 10,
                            color: TEXT,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {m.name}
                        </div>
                        <div style={{ height: 3, background: BG, borderRadius: 2, boxShadow: DN_XS, marginTop: 4 }}>
                          <div
                            style={{
                              height: 3,
                              borderRadius: 2,
                              background: m.avatar_color || ACCENT,
                              width: `${[35, 32, 8][i] ?? 10}%`,
                              transition: "width .5s",
                            }}
                          />
                        </div>
                      </div>
                      <span style={{ fontSize: 9, color: FAINT }}>{[35, 32, 8][i] ?? 10}%</span>
                    </>
                  }
                />
              ))}
            </>
          }
        />

        {/* ÉCHÉANCES */}
        <Tile
          s={{ gridColumn: "1 / 3", gridRow: "3" }}
          ch={
            <>
              <Row
                s={{
                  padding: "11px 16px 8px",
                  justifyContent: "space-between",
                  borderBottom: "1px solid rgba(160,140,108,0.1)",
                }}
                ch={
                  <>
                    <Lbl ch="Prochaines échéances" />
                    <span style={{ fontSize: 10, color: ACCENT, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
                  </>
                }
              />
              {upcoming.length === 0 ? (
                <div style={{ padding: "14px 16px", fontSize: 12, color: FAINT, fontStyle: "italic" }}>
                  Aucune échéance
                </div>
              ) : (
                upcoming.map((t, i) => (
                  <Row
                    key={t.id}
                    s={{
                      padding: "7px 16px",
                      borderBottom: i < upcoming.length - 1 ? "1px solid rgba(160,140,108,0.07)" : "none",
                      gap: 7,
                    }}
                    ch={
                      <>
                        <Dot color={overdue(t) ? DANGER : SUCCESS} />
                        <span
                          style={{
                            fontSize: 11,
                            color: TEXT,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {t.title}
                        </span>
                        <Tag ch={t.status} color={MUTED} />
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: overdue(t) ? DANGER : MUTED,
                            whiteSpace: "nowrap" as const,
                          }}
                        >
                          {overdue(t) ? `${daysLate(t)}j retard` : daysLeft(t) !== null ? `dans ${daysLeft(t)}j` : ""}
                        </span>
                      </>
                    }
                  />
                ))
              )}
            </>
          }
        />

        {/* ACTIVITÉ inset */}
        <Tile
          inset
          s={{ gridColumn: "3", gridRow: "3", padding: "12px 14px" }}
          ch={
            <>
              <Lbl ch="Activité · 7j" s={{ marginBottom: 8 }} />
              <svg width="100%" height={52} viewBox="0 0 110 52" preserveAspectRatio="none">
                <path
                  d={`M${activity.map((v, i) => `${(i / (activity.length - 1)) * 110},${52 - 8 - (v / peakVal) * (52 - 16)}`).join(" L")} L110,52 L0,52 Z`}
                  fill={SUCCESS}
                  fillOpacity="0.1"
                />
                <polyline
                  points={activity
                    .map((v, i) => `${(i / (activity.length - 1)) * 110},${52 - 8 - (v / peakVal) * (52 - 16)}`)
                    .join(" ")}
                  fill="none"
                  stroke={SUCCESS}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div style={{ fontSize: 9, color: MUTED, marginTop: 5 }}>
                Pic{" "}
                <span style={{ color: ACCENT }}>
                  {days7[activity.indexOf(peakVal)]?.slice(8)}/{days7[activity.indexOf(peakVal)]?.slice(5, 7)}
                </span>{" "}
                · <span style={{ color: TEXT }}>{peakVal} tâches</span>
              </div>
            </>
          }
        />

        {/* INTÉGRATIONS */}
        <div
          style={{
            gridColumn: "1 / 4",
            gridRow: "4",
            display: "grid",
            gridTemplateColumns: "repeat(3,minmax(0,1fr))",
            gap: 14,
          }}
        >
          {[
            { name: "Zoom", sub: "0 réunions · Connecter" },
            { name: "Drive", sub: "0 fichiers · Connecter" },
            { name: "Canva", sub: "0 designs · Connecter" },
          ].map(({ name, sub }) => (
            <Tile
              key={name}
              s={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
              ch={
                <>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: BG,
                      boxShadow: UP_SM,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 500, color: ACCENT }}>{name[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: TEXT, fontWeight: 500 }}>{name}</div>
                    <div style={{ fontSize: 9, color: FAINT, marginTop: 1 }}>{sub}</div>
                  </div>
                  <span style={{ fontSize: 13, color: ACCENT, marginLeft: "auto" }}>→</span>
                </>
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
