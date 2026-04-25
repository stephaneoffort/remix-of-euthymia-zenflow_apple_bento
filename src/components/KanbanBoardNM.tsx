import { useState, useCallback, useEffect, useMemo } from "react"; // kanban-nm
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { differenceInDays, parseISO, format } from "date-fns";
import { fr } from "date-fns/locale";
import UseTemplateButton from "@/components/UseTemplateButton";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Tokens ─── */
const BG = "#EDE6DA";
const raised = "5px 5px 12px rgba(140,118,88,0.45),-5px -5px 12px rgba(255,250,242,0.85)";
const raisedSm = "3px 3px 8px rgba(140,118,88,0.5),-3px -3px 8px rgba(255,250,242,0.9)";
const inset = "inset 2px 2px 6px rgba(140,118,88,0.4),inset -2px -2px 6px rgba(255,250,242,0.85)";
const C = {
  text: "#1A1208", muted: "#5A5040", light: "#8A7060",
  orange: "#7A4518", red: "#7A1E0E", green: "#2A5828", blue: "#1E4878",
};

/* ─── Statuts par défaut (couleurs visuelles) ─── */
const STATUS_COLORS: Record<string, string> = {
  todo: "#5A5040",
  in_progress: "#7A4518",
  in_review: "#2A4878",
  done: "#2A5828",
  blocked: "#7A1E0E",
};
/** Hash déterministe pour donner une couleur à un statut personnalisé inconnu. */
function getColorForStatus(key: string): string {
  if (STATUS_COLORS[key]) return STATUS_COLORS[key];
  const palette = ["#5A5040", "#7A4518", "#2A4878", "#2A5828", "#7A1E0E", "#7A5828", "#3A5878", "#5A4878"];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
const COLUMN_ORDER_KEY = "kanban-nm-column-order";

/* ─── Priority badge ─── */
const PriorityPill = ({ priority }: { priority: string }) => {
  const map: Record<string, { bg: string; color: string; label: string; shadow?: string }> = {
    urgent: { bg: C.red,    color: "#FFF0DC", label: "Urgent" },
    high:   { bg: C.orange, color: "#FFF0DC", label: "Haute" },
    normal: { bg: C.blue,   color: "#E0EAFF", label: "Normale" },
    low:    { bg: BG,       color: C.muted,   label: "Basse", shadow: raisedSm },
  };
  const s = map[priority] ?? map.normal;
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
        background: s.bg, color: s.color, boxShadow: s.shadow ?? "none",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {s.label}
    </span>
  );
};

/* ─── Avatar ─── */
const Avatar = ({ name, color }: { name: string; color?: string }) => {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      style={{
        width: 22, height: 22, borderRadius: "50%", background: BG,
        boxShadow: raisedSm, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 700, color: color ?? C.orange,
        fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
};

/* ─── Task Card ─── */
function TaskCard({ task, allTasks, onOpen, getMemberById, getProjectName, statusColor }: {
  task: any; allTasks: any[]; onOpen: (id: string) => void;
  getMemberById: (id: string) => any;
  getProjectName: (listId: string) => any;
  statusColor: string;
}) {
  const project = task.listId ? getProjectName(task.listId) : null;
  const assignees = (task.assigneeIds ?? []).map((id: string) => getMemberById(id)).filter(Boolean);
  const daysLeft = task.dueDate ? differenceInDays(parseISO(task.dueDate), new Date()) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  const isDone = task.status === "done";

  const subtasks = (allTasks ?? []).filter((t: any) => t.parentTaskId === task.id);
  const subtaskDone = subtasks.filter((s: any) => s.status === "done").length;
  const hasSubtasks = subtasks.length > 0;
  const progress = hasSubtasks ? Math.round((subtaskDone / subtasks.length) * 100) : 0;

  return (
    <div
      onClick={() => onOpen(task.id)}
      style={{
        background: BG, borderRadius: 12, boxShadow: raised,
        padding: 12, cursor: "pointer",
        borderLeft: `3px solid ${statusColor}`,
        opacity: isDone ? 0.8 : 1,
        transition: "box-shadow .15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "7px 7px 16px rgba(140,118,88,0.5),-7px -7px 16px rgba(255,250,242,0.9)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = raised; }}
    >
      {/* Projet */}
      {project && (
        <div style={{ marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10, fontWeight: 600, color: C.light,
              textTransform: "uppercase", letterSpacing: "0.04em",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {project.name}
          </span>
        </div>
      )}

      {/* Titre */}
      <div
        style={{
          fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.3,
          marginBottom: 6, fontFamily: "'DM Sans', sans-serif",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}
      >
        {task.title}
      </div>

      {/* Subtasks indicator + progress */}
      {hasSubtasks && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="14" height="14" rx="3" stroke={C.light} strokeWidth="1.3" fill="none" />
              <path d="M4.5 8.5L7 11L11.5 5.5" stroke={subtaskDone === subtasks.length ? C.green : "#5A8A58"} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span data-numeric className="font-numeric tabular-nums" style={{ fontSize: 10, fontWeight: 600, color: subtaskDone === subtasks.length ? C.green : "#5A8A58", fontFamily: "'DM Sans', sans-serif" }}>
              {subtaskDone}/{subtasks.length}
            </span>
          </div>
          <div style={{ height: 3, borderRadius: 2, background: BG, boxShadow: inset }}>
            <div style={{ height: 3, borderRadius: 2, background: subtaskDone === subtasks.length ? C.green : "#5A8A58", width: `${progress}%`, transition: "width .3s" }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <PriorityPill priority={task.priority} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          {daysLeft !== null && (
            <span
              data-numeric
              className="font-numeric tabular-nums"
              style={{
                fontSize: 10, fontWeight: 500,
                color: isDone ? C.green : isOverdue ? C.red : daysLeft <= 2 ? C.orange : C.muted,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {isDone
                ? `✓ ${format(parseISO(task.dueDate!), "d MMM", { locale: fr })}`
                : isOverdue
                  ? `${Math.abs(daysLeft)}j retard`
                  : daysLeft === 0
                    ? "aujourd'hui"
                    : `${daysLeft}j`}
            </span>
          )}
          {assignees.length > 0 && (
            <div style={{ display: "flex", alignItems: "center" }}>
              {assignees.map((a: any, i: number) => (
                <div key={a.id ?? i} title={a.name ?? a.email} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: assignees.length - i }}>
                  <Avatar name={a.name ?? a.email ?? "?"} color={a.avatar_color ?? a.avatarColor} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function KanbanBoardNM() {
  const {
    getFilteredTasks, moveTask, setSelectedTaskId,
    getMemberById, addTask, lists, projects,
    allStatuses, getStatusLabel, selectedProjectId,
    getListsForProject, quickFilter, tasks,
  } = useApp();
  const { teamMemberId } = useAuth();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [mobileActiveStatus, setMobileActiveStatus] = useState<string>(allStatuses[0] || "todo");

  const toggleCollapse = (key: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getProjectName = useCallback((listId: string) => {
    const list = lists.find(l => l.id === listId);
    if (!list) return null;
    return projects.find(p => p.id === list.projectId) ?? null;
  }, [lists, projects]);

  const allTasks = getFilteredTasks();
  const filtered = search
    ? allTasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()))
    : allTasks;

  /* ── Columns dynamiques (statuts personnalisés inclus) ── */
  // Ordre persisté (réorganisable par drag & drop)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        const arr = JSON.parse(saved) as string[];
        if (Array.isArray(arr)) return arr;
      }
    } catch { /* ignore */ }
    return allStatuses;
  });

  // Sync quand allStatuses change (ajout/suppression de statuts personnalisés)
  useEffect(() => {
    setColumnOrder(prev => {
      const existing = new Set(allStatuses);
      const kept = prev.filter(s => existing.has(s));
      const newOnes = allStatuses.filter(s => !kept.includes(s));
      const next = [...kept, ...newOnes];
      try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [allStatuses]);

  const columns = useMemo(
    () => columnOrder
      .filter(key => allStatuses.includes(key) || allTasks.some(t => t.status === key))
      .map(key => ({ key, label: getStatusLabel(key), color: getColorForStatus(key) })),
    [columnOrder, allStatuses, allTasks, getStatusLabel],
  );

  /* ── Drag & Drop tâches ── */
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("type", "task");
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDropTarget(colKey);
  };
  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (draggedTaskId) moveTask(draggedTaskId, colKey);
    setDraggedTaskId(null);
    setDropTarget(null);
  };

  /* ── Drag & Drop colonnes (réorganisation) ── */
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const handleColumnDragStart = (e: React.DragEvent, status: string) => {
    e.dataTransfer.setData("type", "column");
    e.dataTransfer.setData("columnStatus", status);
    e.dataTransfer.effectAllowed = "move";
    setDraggedColumn(status);
  };
  const handleColumnDragOver = (e: React.DragEvent, targetStatus: string) => {
    if (!draggedColumn || draggedColumn === targetStatus) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleColumnDrop = useCallback((e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedColumn || draggedColumn === targetStatus) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(draggedColumn);
      const toIdx = next.indexOf(targetStatus);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, draggedColumn);
      try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setDraggedColumn(null);
  }, [draggedColumn]);
  const handleColumnDragEnd = () => setDraggedColumn(null);

  /* ── Add task ── */
  const handleAddTask = (status: string) => {
    if (!newTaskTitle.trim()) return;
    const projectLists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = projectLists[0]?.id || "l1";
    addTask({
      title: newTaskTitle.trim(),
      description: "",
      status: status as any,
      priority: "normal",
      dueDate: null,
      startDate: null,
      assigneeIds: quickFilter === "my_tasks" && teamMemberId ? [teamMemberId] : [],
      tags: [],
      parentTaskId: null,
      listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewTaskTitle("");
    setNewTaskStatus(null);
  };

  const mobileColTasks = filtered.filter(t => t.status === mobileActiveStatus);
  const mobileCol = columns.find(c => c.key === mobileActiveStatus);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: BG, padding: isMobile ? "8px 8px" : "12px 16px", height: "100%", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 10 }}>

      {/* ── Légende priorités (desktop only) ── */}
      {!isMobile && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C.light, fontWeight: 500 }}>Priorités :</span>
          {[
            { label: "Urgent",  bg: C.red,    color: "#FFF0DC" },
            { label: "Haute",   bg: C.orange, color: "#FFF0DC" },
            { label: "Normale", bg: C.blue,   color: "#E0EAFF" },
            { label: "Basse",   bg: BG,       color: C.muted, shadow: raisedSm },
          ].map(({ label, bg, color, shadow }) => (
            <span
              key={label}
              style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
                background: bg, color, boxShadow: shadow ?? "none",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: BG, boxShadow: inset, borderRadius: 10, padding: "6px 10px", flex: 1, maxWidth: isMobile ? "100%" : 260 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke={C.light} strokeWidth="1.2" />
            <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke={C.light} strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            style={{
              border: "none", background: "transparent", outline: "none",
              fontSize: 12, color: C.muted, width: "100%",
              fontFamily: "'DM Sans', sans-serif",
            }}
          />
        </div>
        {!isMobile && (
          <span data-numeric className="font-numeric tabular-nums" style={{ fontSize: 12, color: C.light, fontWeight: 500, whiteSpace: "nowrap" }}>
            {filtered.length} tâche{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ══════ MOBILE ══════ */}
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {/* Status tabs */}
          <div style={{ display: "flex", gap: 6, padding: "4px 0", overflowX: "auto", flexShrink: 0 }}>
            {columns.map(col => {
              const count = filtered.filter(t => t.status === col.key).length;
              const isActive = mobileActiveStatus === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => setMobileActiveStatus(col.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "6px 12px", borderRadius: 10, border: "none",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    fontSize: 12, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    background: BG,
                    boxShadow: isActive ? inset : raisedSm,
                    color: isActive ? C.orange : C.text,
                    transition: "all .15s",
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
                  {col.label}
                  <span style={{ color: isActive ? C.orange : C.light, fontWeight: 500, fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Active column content */}
          <div style={{ flex: 1, overflowY: "auto", paddingTop: 6 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={mobileActiveStatus}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                {/* Add task button */}
                <div
                  onClick={() => setNewTaskStatus(mobileActiveStatus)}
                  style={{
                    background: BG, borderRadius: 12, boxShadow: inset,
                    padding: 10, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    fontSize: 12, color: C.light, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 700 }}>+</span>
                  Ajouter une tâche
                </div>

                {/* Inline add task */}
                {newTaskStatus === mobileActiveStatus && (
                  <div style={{ background: BG, borderRadius: 12, boxShadow: inset, padding: 10 }}>
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddTask(mobileActiveStatus); if (e.key === "Escape") setNewTaskStatus(null); }}
                      placeholder="Titre de la tâche…"
                      style={{
                        width: "100%", border: "none", background: "transparent", outline: "none",
                        fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif", marginBottom: 6,
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => handleAddTask(mobileActiveStatus)}
                        style={{
                          flex: 1, background: C.green, border: "none", borderRadius: 7,
                          color: "#F0FAF0", fontSize: 12, fontWeight: 700, padding: "5px 0",
                          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Ajouter
                      </button>
                      <button
                        onClick={() => setNewTaskStatus(null)}
                        style={{
                          flex: 1, background: BG, border: "none", borderRadius: 7,
                          boxShadow: raisedSm, color: C.muted, fontSize: 12, padding: "5px 0",
                          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards */}
                {mobileColTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    allTasks={tasks}
                    onOpen={setSelectedTaskId}
                    getMemberById={getMemberById}
                    getProjectName={getProjectName}
                    statusColor={getColorForStatus(task.status)}
                  />
                ))}

                {mobileColTasks.length === 0 && newTaskStatus !== mobileActiveStatus && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: C.light, fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                    Aucune tâche
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* ══════ DESKTOP ══════ */
        <>
          {/* Collapsed chips */}
          {columns.some(c => collapsedColumns.has(c.key)) && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {columns.filter(c => collapsedColumns.has(c.key)).map(col => {
                const count = filtered.filter(t => t.status === col.key).length;
                return (
                  <button
                    key={col.key}
                    onClick={() => toggleCollapse(col.key)}
                    onDragOver={e => handleDragOver(e, col.key)}
                    onDrop={e => handleDrop(e, col.key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      background: BG, boxShadow: raisedSm, border: "none",
                      borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: C.text,
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />
                    {col.label}
                    <span style={{ color: C.light, fontWeight: 500 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Columns grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns.filter(c => !collapsedColumns.has(c.key)).length}, minmax(0,1fr))`,
            gap: 10, flex: 1, overflow: "auto",
          }}>
            {columns.filter(c => !collapsedColumns.has(c.key)).map(col => {
              const colTasks = filtered.filter(t => t.status === col.key);
              const isDropping = dropTarget === col.key;

              return (
                <div
                  key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDrop={e => handleDrop(e, col.key)}
                  onDragLeave={() => { if (dropTarget === col.key) setDropTarget(null); }}
                  style={{
                    display: "flex", flexDirection: "column", gap: 8,
                    transition: "background .15s",
                    background: isDropping ? "rgba(122,69,24,0.04)" : "transparent",
                    borderRadius: 14, padding: isDropping ? 4 : 0,
                  }}
                >
                  {/* Header (drag & drop pour réorganiser les colonnes) */}
                  <div
                    draggable
                    onDragStart={e => handleColumnDragStart(e, col.key)}
                    onDragOver={e => handleColumnDragOver(e, col.key)}
                    onDrop={e => handleColumnDrop(e, col.key)}
                    onDragEnd={handleColumnDragEnd}
                    title="Glissez pour réorganiser les colonnes"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "6px 4px", cursor: "grab",
                      opacity: draggedColumn === col.key ? 0.5 : 1,
                      transition: "opacity .15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(col.key); }}
                        title="Réduire la colonne"
                        style={{
                          background: BG, border: "none", cursor: "pointer", padding: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: 24, height: 24, borderRadius: 7,
                          boxShadow: raisedSm, color: C.muted, fontSize: 13, fontWeight: 700,
                          transition: "box-shadow .15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = inset; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = raisedSm; }}
                      >
                        ‹
                      </button>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {col.label}
                      </span>
                      <span
                        data-numeric
                        className="font-numeric tabular-nums"
                        style={{
                          fontSize: 11, fontWeight: 600, color: C.light,
                          background: BG, boxShadow: raisedSm,
                          borderRadius: 6, padding: "1px 7px",
                        }}
                      >
                        {colTasks.length}
                      </span>
                    </div>
                    {col.key !== "done" && col.key !== "blocked" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setNewTaskStatus(col.key); }}
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          background: BG, boxShadow: raisedSm,
                          border: "none", cursor: "pointer",
                          fontSize: 14, fontWeight: 700, color: C.orange,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>

                  {/* Drop indicator */}
                  {isDropping && (
                    <div style={{ height: 3, borderRadius: 2, background: C.orange, opacity: 0.5, margin: "0 8px" }} />
                  )}

                  {/* Cards */}
                  {colTasks.map(task => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={e => handleDragStart(e, task.id)}
                      onDragEnd={() => { setDraggedTaskId(null); setDropTarget(null); }}
                      style={{ opacity: draggedTaskId === task.id ? 0.4 : 1, transition: "opacity .15s" }}
                    >
                      <TaskCard
                        task={task}
                        allTasks={tasks}
                        onOpen={setSelectedTaskId}
                        getMemberById={getMemberById}
                        getProjectName={getProjectName}
                        statusColor={getColorForStatus(task.status)}
                      />
                    </div>
                  ))}

                  {/* Inline add */}
                  {newTaskStatus === col.key ? (
                    <div style={{ background: BG, borderRadius: 12, boxShadow: inset, padding: 10 }}>
                      <input
                        autoFocus
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddTask(col.key); if (e.key === "Escape") setNewTaskStatus(null); }}
                        placeholder="Titre de la tâche…"
                        style={{
                          width: "100%", border: "none", background: "transparent", outline: "none",
                          fontSize: 13, color: C.text, fontFamily: "'DM Sans', sans-serif", marginBottom: 6,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleAddTask(col.key)}
                          style={{
                            flex: 1, background: C.green, border: "none", borderRadius: 7,
                            color: "#F0FAF0", fontSize: 12, fontWeight: 700, padding: "5px 0",
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Ajouter
                        </button>
                        <button
                          onClick={() => setNewTaskStatus(null)}
                          style={{
                            flex: 1, background: BG, border: "none", borderRadius: 7,
                            boxShadow: raisedSm, color: C.muted, fontSize: 12, padding: "5px 0",
                            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                          }}
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    col.key !== "done" && col.key !== "blocked" && (
                      <div
                        onClick={() => setNewTaskStatus(col.key)}
                        style={{
                          background: BG, borderRadius: 12, boxShadow: inset,
                          padding: 10, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                          fontSize: 12, color: C.light, fontWeight: 500,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 700 }}>+</span>
                        Ajouter
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
