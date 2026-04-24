import React, { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { usePresence } from "@/hooks/usePresence";
import { Sparkles, Flame, Clock, CheckCircle2, AlertCircle, ArrowRight, Zap, Users, LayoutGrid } from "lucide-react";
import { ViewType, QuickFilter } from "@/types";

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "hsl(var(--priority-urgent))",
  high: "hsl(var(--priority-high))",
  normal: "hsl(var(--priority-normal))",
  low: "hsl(var(--priority-low))",
};

const STATUS_LABEL: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  in_review: "En revue",
  done: "Terminé",
  blocked: "Bloqué",
};

export default function BentoDashboard() {
  const { tasks, projects, teamMembers, lists, setSelectedProjectId, setSelectedView, setQuickFilter } = useApp();
  const { teamMemberId } = useAuth();
  const { isOnline } = usePresence();

  const today = new Date().toISOString().split("T")[0];

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t) => t.status === "done"), [tasks]);
  const myTasks = useMemo(
    () => openTasks.filter((t) => t.assigneeIds.includes(teamMemberId ?? "")),
    [openTasks, teamMemberId],
  );
  const urgentTasks = useMemo(() => openTasks.filter((t) => t.priority === "urgent").slice(0, 5), [openTasks]);
  const dueTodayTasks = useMemo(() => openTasks.filter((t) => t.dueDate === today).slice(0, 4), [openTasks, today]);
  const overdueTasks = useMemo(() => openTasks.filter((t) => t.dueDate && t.dueDate < today), [openTasks, today]);
  const completionPct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  const currentMember = teamMembers.find((m) => m.id === teamMemberId);
  const onlineMemberIds = teamMembers.filter((m) => isOnline(m.id)).length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  };

  const firstName = currentMember?.name.split(" ")[0] ?? "";

  const goTo = (view: ViewType, filter?: QuickFilter) => {
    setSelectedView(view);
    if (filter) setQuickFilter(filter);
  };

  // Progression par projet (tâches dans les listes du projet)
  const projectProgress = useMemo(
    () =>
      projects.map((p) => {
        const projectListIds = lists.filter((l) => l.projectId === p.id).map((l) => l.id);
        const pTasks = tasks.filter((t) => projectListIds.includes(t.listId));
        const pDone = pTasks.filter((t) => t.status === "done").length;
        const pPct = pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0;
        return { ...p, total: pTasks.length, done: pDone, pct: pPct };
      }),
    [projects, tasks, lists],
  );

  return (
    <div className="bento-container">
      {/* ── HERO ─────────────────────────────────────────── */}
      <div className="bento-cell bento-hero">
        <div className="bento-cell-inner">
          <div>
            <p className="bento-hero-label">
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <h2 className="bento-hero-title font-display">
              {greeting()}
              {firstName ? `, ${firstName}` : ""}
            </h2>
            <p className="bento-hero-sub">
              {openTasks.length} tâches ouvertes
              {overdueTasks.length > 0 ? ` · ${overdueTasks.length} en retard` : " · tout à jour ✓"}
            </p>
          </div>

          <div className="bento-stats-row">
            {[
              { n: doneTasks.length, l: "Terminées", c: "hsl(var(--status-done))" },
              { n: openTasks.length, l: "En cours", c: "hsl(var(--status-progress))" },
              { n: overdueTasks.length, l: "En retard", c: overdueTasks.length > 0 ? "hsl(var(--priority-urgent))" : "hsl(var(--muted-foreground))" },
              { n: `${completionPct}%`, l: "Complété", c: "hsl(var(--primary))" },
            ].map(({ n, l, c }) => (
              <div key={l} className="bento-stat">
                <span
                  data-numeric
                  className="bento-stat-n font-numeric"
                  style={{ color: c, fontVariantNumeric: 'tabular-nums' }}
                >
                  {n}
                </span>
                <span className="bento-stat-l">{l}</span>
              </div>
            ))}
          </div>

          <div className="bento-progress-bar">
            <div className="bento-progress-fill" style={{ width: `${completionPct}%` }} />
          </div>

          <div className="bento-actions">
            <button className="bento-btn-primary" onClick={() => goTo("list")}>
              Toutes les tâches <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button className="bento-btn-ghost" onClick={() => goTo("kanban")}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button className="bento-btn-ghost" onClick={() => goTo("calendar")}>
              Calendrier
            </button>
          </div>
        </div>
        <div className="bento-hero-glow" />
      </div>

      {/* ── URGENT ───────────────────────────────────────── */}
      <div className="bento-cell bento-urgent">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <Flame className="w-4 h-4 bento-icon-urgent" />
            <span className="bento-cell-title">Urgent</span>
            <span data-numeric className="bento-badge bento-badge-urgent">{urgentTasks.length}</span>
          </div>

          {urgentTasks.length === 0 ? (
            <div className="bento-empty">
              <CheckCircle2 className="w-7 h-7 bento-empty-icon" />
              <p>Aucune tâche urgente</p>
            </div>
          ) : (
            <div className="bento-task-list">
              {urgentTasks.map((task) => (
                <div key={task.id} className="bento-task-item">
                  <div className="bento-task-dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
                  <div className="bento-task-content">
                    <p className="bento-task-title">{task.title}</p>
                    <p className="bento-task-meta">
                      {task.dueDate && (
                        <>
                          <Clock className="w-3 h-3" />
                          {task.dueDate < today ? "En retard" : task.dueDate === today ? "Aujourd'hui" : task.dueDate}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="bento-btn-link" onClick={() => goTo("list", "urgent")}>
            Voir toutes <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── MES TÂCHES ───────────────────────────────────── */}
      <div className="bento-cell">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <CheckCircle2 className="w-4 h-4 bento-icon-blue" />
            <span className="bento-cell-title">Mes tâches</span>
            <span data-numeric className="bento-badge bento-badge-blue">{myTasks.length}</span>
          </div>

          {myTasks.length === 0 ? (
            <div className="bento-empty">
              <p>Aucune tâche assignée</p>
            </div>
          ) : (
            <div className="bento-task-list">
              {myTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="bento-task-item">
                  <div className="bento-task-dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
                  <div className="bento-task-content">
                    <p className="bento-task-title">{task.title}</p>
                    <p className="bento-task-meta">{STATUS_LABEL[task.status] ?? task.status}</p>
                  </div>
                </div>
              ))}
              {myTasks.length > 3 && <p data-numeric className="bento-more">+{myTasks.length - 3} autres</p>}
            </div>
          )}

          <button className="bento-btn-link" onClick={() => goTo("list", "my_tasks")}>
            Voir les miennes <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── AUJOURD'HUI ──────────────────────────────────── */}
      <div className="bento-cell">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <Clock className="w-4 h-4 bento-icon-amber" />
            <span className="bento-cell-title">Aujourd'hui</span>
            <span data-numeric className="bento-badge bento-badge-amber">{dueTodayTasks.length}</span>
          </div>

          {dueTodayTasks.length === 0 ? (
            <div className="bento-empty">
              <p>Rien à livrer aujourd'hui</p>
            </div>
          ) : (
            <div className="bento-task-list">
              {dueTodayTasks.map((task) => (
                <div key={task.id} className="bento-task-item">
                  <div className="bento-task-dot" style={{ background: PRIORITY_COLOR[task.priority] }} />
                  <div className="bento-task-content">
                    <p className="bento-task-title">{task.title}</p>
                    <p className="bento-task-meta">{STATUS_LABEL[task.status] ?? task.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="bento-btn-link" onClick={() => goTo("list", "today")}>
            Vue agenda <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── ÉQUIPE ───────────────────────────────────────── */}
      <div className="bento-cell">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <Users className="w-4 h-4 bento-icon-teal" />
            <span className="bento-cell-title">Équipe</span>
            <span className="bento-badge bento-badge-teal">{onlineMemberIds} en ligne</span>
          </div>

          <div className="bento-team-list">
            {teamMembers.map((m) => (
              <div key={m.id} className="bento-member">
                <div className="bento-member-avatar-wrap">
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.name} className="bento-member-avatar" />
                  ) : (
                    <div className="bento-member-initials" style={{ background: m.avatarColor }}>
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </div>
                  )}
                  <span
                    className={`bento-member-dot ${isOnline(m.id) ? "bento-member-online" : "bento-member-offline"}`}
                  />
                </div>
                <div className="bento-member-info">
                  <p className="bento-member-name">{m.name.split(" ")[0]}</p>
                  <p className="bento-member-role">{m.role}</p>
                </div>
                <span
                  className={`text-[11px] font-semibold ml-auto ${isOnline(m.id) ? 'text-green-400' : 'text-muted-foreground'}`}
                >
                  {isOnline(m.id) ? "● En ligne" : "○ Absent"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── IA ───────────────────────────────────────────── */}
      <div className="bento-cell bento-ai">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <Sparkles className="w-4 h-4 bento-icon-purple" />
            <span className="bento-cell-title">Suggestions IA</span>
          </div>

          <div className="bento-ai-content">
            <Zap className="w-8 h-8 bento-ai-icon" />
            <p className="bento-ai-text">
              Analysez vos projets et obtenez des suggestions de tâches basées sur vos délais et priorités actuels.
            </p>
          </div>

          <button className="bento-btn-ai">
            <Sparkles className="w-3.5 h-3.5" />
            Obtenir des suggestions
          </button>
        </div>
        <div className="bento-ai-glow" />
      </div>

      {/* ── PROJETS (full width) ─────────────────────────── */}
      <div className="bento-cell bento-projects">
        <div className="bento-cell-inner">
          <div className="bento-cell-header">
            <span className="bento-cell-title">Avancement des projets</span>
          </div>

          <div className="bento-projects-grid">
            {projectProgress.map((p) => (
              <button
                key={p.id}
                className="bento-project-item"
                onClick={() => {
                  setSelectedProjectId(p.id);
                  setSelectedView("kanban");
                }}
              >
                <div className="bento-project-dot" style={{ background: p.color }} />
                <div className="bento-project-info">
                  <p className="bento-project-name">{p.name}</p>
                  <div className="bento-mini-bar">
                    <div className="bento-mini-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span data-numeric className="bento-project-pct">{p.pct}%</span>
                  <p data-numeric className="text-[10px] text-muted-foreground mt-px">
                    {p.done}/{p.total}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
