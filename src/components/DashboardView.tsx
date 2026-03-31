import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ─── COULEURS ─── */
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

/* ─── TYPES ─── */
type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  description: string;
  tags: string[];
  progress: number | null;
  time_estimate: number | null;
  time_logged: number | null;
};
type Member = { id: string; name: string; avatar_color: string };

/* ─── HELPERS ─── */
const done = (t: Task) => ["done", "terminé", "terminée", "completed"].includes(t.status.toLowerCase());
const overdue = (t: Task) => !done(t) && !!t.due_date && new Date(t.due_date) < new Date();
const urgent = (t: Task) => ["urgent", "urgente", "high", "haute"].includes(t.priority.toLowerCase());
const daysLate = (t: Task) => (t.due_date ? Math.round((Date.now() - new Date(t.due_date).getTime()) / 86400000) : 0);
const daysLeft = (t: Task) =>
  t.due_date ? Math.round((new Date(t.due_date).getTime() - Date.now()) / 86400000) : null;
const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";
const statusColor = (s: string) => {
  const m: Record<string, string> = {
    done: SUCCESS,
    terminé: SUCCESS,
    terminée: SUCCESS,
    completed: SUCCESS,
    urgent: DANGER,
    high: DANGER,
  };
  return m[s.toLowerCase()] ?? ACCENT;
};

/* ─── COMPOSANTS DE BASE ─── */
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
      style={{
        background: BG,
        borderRadius: 16,
        boxShadow: inset ? DN : UP,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function Lbl({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        color: MUTED,
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
function Tag({ children, color = MUTED }: { children: string; color?: string }) {
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
      {children}
    </span>
  );
}
function Dot({ color }: { color: string }) {
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

/* ─── MODALE DÉTAIL TÂCHE ─── */
function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);

  const save = async () => {
    setSaving(true);
    await supabase.from("tasks").update({ status, priority }).eq("id", task.id);
    setSaving(false);
    onClose();
  };

  const statusOptions = ["todo", "in_progress", "in_review", "done", "blocked"];
  const priorityOptions = ["urgent", "high", "normal", "low"];

  return (
    /* Fond assombri */
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(45,40,32,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: SANS,
      }}
    >
      {/* Fenêtre modale */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BG,
          borderRadius: 20,
          boxShadow: UP,
          width: "100%",
          maxWidth: 560,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid rgba(160,140,108,0.12)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 300, color: TEXT, lineHeight: 1.2, flex: 1 }}>
              {task.title}
            </div>
            <button
              onClick={onClose}
              style={{
                background: BG,
                border: "none",
                borderRadius: 8,
                boxShadow: UP_SM,
                color: MUTED,
                cursor: "pointer",
                fontSize: 16,
                padding: "4px 10px",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>

          {/* Badges statut + priorité */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" as const }}>
            <span
              style={{
                background: BG,
                borderRadius: 100,
                boxShadow: UP_XS,
                color: statusColor(status),
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 10px",
              }}
            >
              {status}
            </span>
            <span
              style={{
                background: BG,
                borderRadius: 100,
                boxShadow: UP_XS,
                color: urgent(task) ? DANGER : ACCENT,
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 10px",
              }}
            >
              {priority}
            </span>
            {overdue(task) && (
              <span
                style={{
                  background: BG,
                  borderRadius: 100,
                  boxShadow: UP_XS,
                  color: DANGER,
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "3px 10px",
                }}
              >
                {daysLate(task)}j de retard
              </span>
            )}
            {!overdue(task) && daysLeft(task) !== null && (
              <span
                style={{
                  background: BG,
                  borderRadius: 100,
                  boxShadow: UP_XS,
                  color: MUTED,
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "3px 10px",
                }}
              >
                dans {daysLeft(task)}j
              </span>
            )}
          </div>
        </div>

        {/* Corps */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Description */}
          {task.description && (
            <div>
              <Lbl style={{ marginBottom: 8 }}>Description</Lbl>
              <div
                style={{
                  background: BG,
                  borderRadius: 12,
                  boxShadow: DN_XS,
                  padding: "12px 14px",
                  fontSize: 13,
                  color: TEXT,
                  lineHeight: 1.7,
                }}
              >
                {task.description}
              </div>
            </div>
          )}

          {/* Infos */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Échéance", val: fmtDate(task.due_date) },
              { label: "Progression", val: task.progress != null ? `${task.progress}%` : "—" },
              { label: "Temps estimé", val: task.time_estimate != null ? `${task.time_estimate}h` : "—" },
              { label: "Temps logué", val: task.time_logged != null ? `${task.time_logged}h` : "—" },
            ].map(({ label, val }) => (
              <div key={label} style={{ background: BG, borderRadius: 10, boxShadow: DN_XS, padding: "10px 12px" }}>
                <Lbl style={{ marginBottom: 4 }}>{label}</Lbl>
                <div style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div>
              <Lbl style={{ marginBottom: 8 }}>Tags</Lbl>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {task.tags.map((tag) => (
                  <Tag key={tag} color={ACCENT}>
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {/* Modifier statut */}
          <div>
            <Lbl style={{ marginBottom: 8 }}>Modifier le statut</Lbl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  style={{
                    background: BG,
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    boxShadow: status === s ? DN_XS : UP_XS,
                    color: status === s ? statusColor(s) : MUTED,
                    fontSize: 11,
                    fontWeight: status === s ? 600 : 400,
                    padding: "6px 12px",
                    transition: "all .15s",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Modifier priorité */}
          <div>
            <Lbl style={{ marginBottom: 8 }}>Modifier la priorité</Lbl>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
              {priorityOptions.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  style={{
                    background: BG,
                    border: "none",
                    borderRadius: 8,
                    cursor: "pointer",
                    boxShadow: priority === p ? DN_XS : UP_XS,
                    color: priority === p ? ACCENT : MUTED,
                    fontSize: 11,
                    fontWeight: priority === p ? 600 : 400,
                    padding: "6px 12px",
                    transition: "all .15s",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Boutons action */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                background: ACCENT,
                border: "none",
                borderRadius: 10,
                color: "#FFF8F0",
                cursor: "pointer",
                flex: 1,
                fontSize: 13,
                fontWeight: 500,
                padding: "12px",
                boxShadow: `4px 4px 10px rgba(160,100,40,0.4),-2px -2px 8px rgba(255,240,210,0.3)`,
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button
              onClick={onClose}
              style={{
                background: BG,
                border: "none",
                borderRadius: 10,
                color: MUTED,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                padding: "12px 20px",
                boxShadow: UP_SM,
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── DASHBOARD PRINCIPAL ─── */
export default function DashboardView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Task | null>(null);

  const loadTasks = async () => {
    const [{ data: t }, { data: m }] = await Promise.all([
      supabase
        .from("tasks")
        .select("id,title,status,priority,due_date,description,tags,progress,time_estimate,time_logged")
        .order("due_date", { ascending: true }),
      supabase.from("team_members").select("id,name,avatar_color"),
    ]);
    setTasks(t ?? []);
    setTeam(m ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  /* Fermeture modale + rechargement */
  const closeModal = () => {
    setSelected(null);
    loadTasks();
  };

  const total = tasks.length;
  const nDone = tasks.filter(done).length;
  const nUrgent = tasks.filter((t) => !done(t) && urgent(t)).length;
  const nLate = tasks.filter(overdue).length;
  const nPend = total - nDone;
  const pct = total > 0 ? Math.round((nDone / total) * 100) : 0;

  const urgentList = tasks.filter((t) => !done(t) && urgent(t)).slice(0, 4);
  const upcoming = tasks.filter((t) => !done(t)).slice(0, 4);
  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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

      {/* MODALE */}
      {selected && <TaskModal task={selected} onClose={closeModal} />}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 14 }}>
        {/* HERO */}
        <Tile style={{ padding: "20px 22px" }}>
          <Lbl>{date}</Lbl>
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
          <div style={{ color: ACCENT, fontSize: 11, marginTop: 5 }}>{nPend} tâches en attente</div>
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
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: FAINT, marginTop: 4 }}>
              <span>0</span>
              <span>
                {pct}% · {nDone}/{total}
              </span>
              <span>{total}</span>
            </div>
          </div>
        </Tile>

        {/* TOTAL inset */}
        <Tile inset style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
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
            {nPend}
          </div>
          <div style={{ fontSize: 9, color: FAINT, marginTop: 3, letterSpacing: "0.5px" }}>tâches en attente</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { dot: ACCENT, lbl: "Urgentes", val: nUrgent },
              { dot: DANGER, lbl: "En retard", val: nLate },
              { dot: SUCCESS, lbl: "Terminées", val: nDone },
            ].map(({ dot, lbl, val }) => (
              <div
                key={lbl}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  background: BG,
                  borderRadius: 10,
                  boxShadow: UP_SM,
                  padding: "6px 10px",
                }}
              >
                <Dot color={dot} />
                <span style={{ fontSize: 10, color: MUTED, flex: 1 }}>{lbl}</span>
                <span style={{ fontFamily: SERIF, fontSize: 16, color: TEXT }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* PROGRESSION */}
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
          <Lbl>Progression</Lbl>
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
        </Tile>

        {/* URGENTES — cliquables */}
        <Tile style={{ gridColumn: "1", gridRow: "2" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 16px 8px",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Lbl>À traiter</Lbl>
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
          </div>
          {urgentList.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 12, color: FAINT, fontStyle: "italic" }}>
              Aucune tâche urgente 🎉
            </div>
          ) : (
            urgentList.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderLeft: `2px solid ${overdue(t) ? DANGER : ACCENT}`,
                  cursor: "pointer",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(184,116,64,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
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
                <Tag color={overdue(t) ? DANGER : ACCENT}>{t.status}</Tag>
                {overdue(t) && (
                  <span style={{ fontSize: 10, color: DANGER, fontWeight: 500 }}>{daysLate(t)}j retard</span>
                )}
              </div>
            ))
          )}
        </Tile>

        {/* DONUT */}
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
          <Lbl style={{ marginBottom: 8 }}>Répartition</Lbl>
          {(() => {
            const segs = [
              { v: nLate, c: DANGER },
              { v: Math.max(1, Math.round(total * 0.1)), c: ACCENT },
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
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Dot color={c} />
                <span style={{ fontSize: 9, color: MUTED, flex: 1 }}>{lbl}</span>
                <span style={{ fontSize: 9, color: TEXT, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ÉQUIPE inset */}
        <Tile inset style={{ gridColumn: "3", gridRow: "2", padding: "12px 14px" }}>
          <Lbl style={{ marginBottom: 10 }}>Équipe</Lbl>
          {team.slice(0, 3).map((m, i) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
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
            </div>
          ))}
        </Tile>

        {/* ÉCHÉANCES — cliquables */}
        <Tile style={{ gridColumn: "1 / 3", gridRow: "3" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "11px 16px 8px",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Lbl>Prochaines échéances</Lbl>
            <span style={{ fontSize: 10, color: ACCENT, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
          </div>
          {upcoming.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: 12, color: FAINT, fontStyle: "italic" }}>Aucune échéance</div>
          ) : (
            upcoming.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 16px",
                  borderBottom: i < upcoming.length - 1 ? "1px solid rgba(160,140,108,0.07)" : "none",
                  cursor: "pointer",
                  transition: "background .15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(184,116,64,0.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
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
                <Tag color={MUTED}>{t.status}</Tag>
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
              </div>
            ))
          )}
        </Tile>

        {/* ACTIVITÉ inset */}
        <Tile inset style={{ gridColumn: "3", gridRow: "3", padding: "12px 14px" }}>
          <Lbl style={{ marginBottom: 8 }}>Activité · 7j</Lbl>
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
        </Tile>

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
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
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
            </Tile>
          ))}
        </div>
      </div>
    </div>
  );
}
