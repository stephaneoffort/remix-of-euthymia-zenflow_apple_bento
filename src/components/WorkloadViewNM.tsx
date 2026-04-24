import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { format, parseISO, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Tokens ─── */
const BG = "#EDE6DA";
const raised = "6px 6px 14px rgba(140,118,88,0.5),-6px -6px 14px rgba(255,250,242,0.9)";
const raisedSm = "3px 3px 8px rgba(140,118,88,0.45),-3px -3px 8px rgba(255,250,242,0.85)";
const raisedXs = "2px 2px 5px rgba(140,118,88,0.45),-2px -2px 5px rgba(255,250,242,0.85)";
const inset = "inset 2px 2px 5px rgba(140,118,88,0.4),inset -2px -2px 5px rgba(255,250,242,0.85)";
const insetSm = "inset 1px 1px 3px rgba(140,118,88,0.3),inset -1px -1px 3px rgba(255,250,242,0.7)";
const C = {
  text: "#1A1208", muted: "#5A5040", light: "#8A7060",
  orange: "#7A4518", red: "#7A1E0E", green: "#2A5828", blue: "#1E4878",
  border: "rgba(140,118,88,0.12)",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: C.red, high: C.orange, normal: C.blue, low: "rgba(140,118,88,0.25)",
};
const PRIORITY_TEXT: Record<string, string> = {
  urgent: "#FFF0DC", high: "#FFF0DC", normal: "#E0EAFF", low: C.light,
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "U", high: "H", normal: "N", low: "B",
};

/* ─── Helpers ─── */
const Lbl = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: 600,
    color: C.muted, textTransform: "uppercase", letterSpacing: 0.5,
  }}>
    {children}
  </span>
);

const Btn = ({ children, active, green, onClick }: {
  children: React.ReactNode; active?: boolean; green?: boolean; onClick?: () => void;
}) => (
  <button onClick={onClick} style={{
    background: green ? C.green : BG,
    color: green ? "#F0FAF0" : active ? C.text : C.muted,
    border: "none", borderRadius: 8, cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: active ? 700 : 500,
    padding: "5px 12px",
    boxShadow: active ? insetSm : raisedXs,
    transition: "all 0.18s ease",
  }}>{children}</button>
);

export default function WorkloadViewNM() {
  const { tasks, teamMembers, setSelectedTaskId } = useApp();
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  /* ── Stats globales ── */
  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter(t => t.status === "done").length;
    const unassigned = tasks.filter(t => !t.assigneeIds?.length).length;
    return { total, done, unassigned };
  }, [tasks]);

  /* ── Charge par membre ── */
  const workload = useMemo(() => {
    return teamMembers.map(m => {
      const memberTasks = tasks.filter(t => t.assigneeIds?.includes(m.id));
      const done = memberTasks.filter(t => t.status === "done").length;
      const completion = memberTasks.length > 0 ? Math.round((done / memberTasks.length) * 100) : 0;
      const byPriority = {
        urgent: memberTasks.filter(t => t.priority === "urgent").length,
        high:   memberTasks.filter(t => t.priority === "high").length,
        normal: memberTasks.filter(t => t.priority === "normal").length,
        low:    memberTasks.filter(t => t.priority === "low").length,
      };
      const upcoming = memberTasks
        .filter(t => t.dueDate && t.status !== "done")
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 3);
      return { ...m, memberTasks, done, completion, byPriority, upcoming, total: memberTasks.length };
    }).filter(m => m.total > 0).sort((a, b) => b.total - a.total);
  }, [tasks, teamMembers]);

  const daysLabel = (due: string) => {
    const diff = differenceInDays(parseISO(due), new Date());
    if (diff < 0) return `${Math.abs(diff)}j retard`;
    if (diff === 0) return "auj.";
    return format(parseISO(due), "d MMM", { locale: fr });
  };

  const priorityColor = (due: string) => {
    const diff = differenceInDays(parseISO(due), new Date());
    if (diff < 0) return C.red;
    if (diff <= 2) return C.orange;
    return C.muted;
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: BG, padding: 20, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "8px 14px", borderRadius: 12, boxShadow: raised, background: BG, marginBottom: 18,
      }}>
        <Btn active>
          <span style={{ fontSize: 11 }}>Presets ▾</span>
        </Btn>
        <div style={{ width: 1, height: 20, background: C.border }} />

        <Btn>Avancement ▾</Btn>
        <Btn>Priorité ▾</Btn>
        <Btn>Responsable ▾</Btn>

        <div style={{ flex: 1 }} />

        {/* Période */}
        <div style={{
          display: "flex", gap: 2, background: BG, borderRadius: 9, boxShadow: insetSm, padding: 3,
        }}>
          {([
            { v: "week" as const, l: "Sem." },
            { v: "month" as const, l: "Mois" },
            { v: "quarter" as const, l: "Trim." },
          ]).map(({ v, l }) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              background: period === v ? C.green : "transparent", border: "none", borderRadius: 7, cursor: "pointer",
              color: period === v ? "#F0FAF0" : C.text,
              fontFamily: "'DM Sans', sans-serif", fontSize: 10, fontWeight: period === v ? 700 : 500, padding: "5px 10px",
              boxShadow: period === v ? "3px 3px 7px rgba(20,50,20,0.4)" : "none",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Stats globales ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {([
          { value: stats.total, label: "Total tâches", color: C.text },
          { value: stats.unassigned, label: "Non assignées", color: stats.unassigned > 0 ? C.red : C.text },
          { value: stats.done, label: "Terminées", color: C.green },
          { value: 0, label: "Recyclées", color: C.text },
        ]).map(({ value, label, color }) => (
          <div key={label} style={{
            background: BG, borderRadius: 14, boxShadow: raisedSm, padding: "14px 10px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'Cormorant Garamond', serif" }}>{value}</div>
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Charge par membre ── */}
      <div style={{ background: BG, borderRadius: 16, boxShadow: raised, padding: 16, marginBottom: 20 }}>
        <Lbl>Charge par membre</Lbl>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {workload.map(m => {
            const initials = m.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            const total = m.total;
            const isSelected = selectedMemberId === m.id;
            return (
              <div key={m.id} onClick={() => setSelectedMemberId(isSelected ? null : m.id)} style={{
                background: BG, borderRadius: 12, padding: "10px 12px", cursor: "pointer",
                boxShadow: isSelected ? inset : raisedXs,
                outline: isSelected ? `2px solid ${C.green}` : "none",
                transition: "all 0.2s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: m.avatarColor,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: "#fff", boxShadow: raisedXs,
                  }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.name}</div>
                    <div data-numeric className="font-numeric tabular-nums" style={{ fontSize: 9, color: C.muted }}>{total} tâches · {m.done} terminées</div>
                  </div>
                  <div data-numeric className="font-numeric tabular-nums" style={{ fontSize: 13, fontWeight: 800, color: C.green }}>{m.completion}%</div>
                </div>
                {/* Barre empilée priorités */}
                <div style={{
                  display: "flex", height: 14, borderRadius: 7, overflow: "hidden", boxShadow: insetSm,
                }}>
                  {(["urgent", "high", "normal", "low"] as const).map(p => {
                    const count = m.byPriority[p];
                    if (count === 0) return null;
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={p} style={{
                        width: `${pct}%`, background: PRIORITY_COLORS[p],
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{
                          fontSize: 7, fontWeight: 800, color: PRIORITY_TEXT[p], letterSpacing: 0.3,
                        }}>
                          {PRIORITY_LABELS[p]}·{count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Tâches par membre ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, marginBottom: 20 }}>
        {workload.filter(m => !selectedMemberId || m.id === selectedMemberId).map(m => {
          const initials = m.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={m.id} style={{
              background: BG, borderRadius: 14, boxShadow: raisedSm, padding: 14,
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", background: m.avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#fff", boxShadow: raisedXs,
                }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{m.name}</div>
                  <div style={{ fontSize: 9, color: C.muted }}>{m.total} tâches</div>
                </div>
              </div>

              {/* Tâches */}
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(expandedMembers.has(m.id)
                  ? m.memberTasks.filter(t => t.status !== "done").sort((a, b) => new Date(a.dueDate ?? "9999").getTime() - new Date(b.dueDate ?? "9999").getTime())
                  : m.upcoming
                ).map(t => {
                  const borderColor = PRIORITY_COLORS[t.priority] ?? C.orange;
                  const dColor = t.dueDate ? priorityColor(t.dueDate) : C.muted;
                  return (
                    <div key={t.id} onClick={() => setSelectedTaskId(t.id)} style={{
                      display: "flex", alignItems: "center", gap: 7, padding: "6px 9px",
                      background: BG, borderRadius: 8, boxShadow: insetSm,
                      borderLeft: `2px solid ${borderColor}`, cursor: "pointer",
                    }}>
                      <span style={{ flex: 1, fontSize: 11, color: C.text, fontWeight: 500 }}>{t.title}</span>
                      {t.dueDate && (
                        <span style={{ fontSize: 9, fontWeight: 600, color: dColor, whiteSpace: "nowrap" }}>
                          {daysLabel(t.dueDate)}
                        </span>
                      )}
                    </div>
                  );
                })}
                {m.total > 3 && (
                  <div onClick={() => setExpandedMembers(prev => {
                    const next = new Set(prev);
                    next.has(m.id) ? next.delete(m.id) : next.add(m.id);
                    return next;
                  })} style={{
                    fontSize: 10, color: C.green, fontWeight: 600, textAlign: "center",
                    padding: "4px 0", cursor: "pointer",
                  }}>
                    {expandedMembers.has(m.id) ? "↑ Réduire" : `+ ${m.total - 3} autres →`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Légende ── */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "8px 12px", borderRadius: 10, boxShadow: insetSm, fontSize: 10, color: C.muted,
      }}>
        {([
          { color: C.red,    label: "Urgent (U)" },
          { color: C.orange, label: "Haute (H)" },
          { color: C.blue,   label: "Normale (N)" },
          { color: "rgba(140,118,88,0.25)", label: "Basse (B)" },
        ]).map(({ color, label }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontStyle: "italic", fontSize: 9 }}>
          Clic sur une tâche → panneau latéral
        </span>
      </div>
    </div>
  );
}
