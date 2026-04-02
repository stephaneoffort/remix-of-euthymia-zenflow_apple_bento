import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { useCalendarSync, type CalendarEvent } from "@/hooks/useCalendarSync";
import { useTaskMeetings } from "@/hooks/useTaskMeetings";
import CalendarEventDialog from "@/components/CalendarEventDialog";
import { type Task, PRIORITY_LABELS } from "@/types";

/* ─── Design tokens ─── */
const BG = "#EDE6DA";
const raised = "6px 6px 14px rgba(160,140,108,0.45),-6px -6px 14px rgba(255,252,246,0.85)";
const raisedSm = "3px 3px 8px rgba(160,140,108,0.45),-3px -3px 8px rgba(255,252,246,0.85)";
const inset = "inset 3px 3px 7px rgba(160,140,108,0.45),inset -3px -3px 7px rgba(255,252,246,0.85)";
const insetSm = "inset 2px 2px 5px rgba(160,140,108,0.4),inset -2px -2px 5px rgba(255,252,246,0.8)";

const C = {
  text: "#2D2820", muted: "#8A7E6E", light: "#B0A494",
  orange: "#B87440", red: "#B85040", green: "#6B8F6A", blue: "#3B6EA5",
  border: "rgba(160,140,108,0.12)",
};

type CalMode = "month" | "week" | "day";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAYS_FR_FULL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7h-19h

/* ─── Helpers ─── */
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date) { return isSameDay(d, new Date()); }
function getFrDayIndex(d: Date) { const day = d.getDay(); return day === 0 ? 6 : day - 1; }
function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d); monday.setDate(d.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(monday); dd.setDate(monday.getDate() + i); return dd; });
}

const priorityColor = (p: string) => ({
  urgent: { bg: "#7A1E0E", text: "#FFF0DC" },
  high:   { bg: C.orange, text: "#FFF0DC" },
  normal: { bg: C.blue,   text: "#E0EAFF" },
  low:    { bg: BG,       text: C.muted },
}[p] ?? { bg: C.blue, text: "#E0EAFF" });

/* ─── NM Button ─── */
function NmBtn({ children, active, accent, onClick, style }: {
  children: React.ReactNode; active?: boolean; accent?: boolean; onClick?: () => void; style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: BG, border: "none", borderRadius: 10, cursor: "pointer",
        padding: "7px 14px", fontFamily: "'DM Sans', sans-serif",
        fontSize: 12, fontWeight: active ? 700 : 500,
        color: accent ? "#FFF" : active ? C.orange : C.text,
        boxShadow: accent ? `${raisedSm}, inset 0 0 0 1px ${C.green}` : active ? insetSm : raisedSm,
        ...(accent ? { background: C.green } : {}),
        transition: "all .18s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export default function CalendarViewNM() {
  const { getFilteredTasks, setSelectedTaskId, addTask, updateTask, selectedProjectId, getListsForProject, teamMembers, tasks: allTasks } = useApp();
  const calSync = useCalendarSync();
  const { zoomTaskIds, meetTaskIds } = useTaskMeetings();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [mode, setMode] = useState<CalMode>("month");
  const [addingForDate, setAddingForDate] = useState<string | null>(null);
  const [addingForHour, setAddingForHour] = useState<string | null>(null); // "date|hour"
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventDialogDate, setEventDialogDate] = useState<string | undefined>();
  const [hourHeight, setHourHeight] = useState(64);
  const [dragOverHour, setDragOverHour] = useState<string | null>(null);
  const [droppedHour, setDroppedHour] = useState<string | null>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setHourHeight(prev => Math.min(200, Math.max(32, prev - e.deltaY * 0.3)));
    }
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const flashDrop = useCallback((key: string) => {
    setDroppedHour(key);
    setTimeout(() => setDroppedHour(null), 500);
  }, []);

  const handleDropOnHour = useCallback((e: React.DragEvent, dateStr: string, hour: number) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const hourKey = `${dateStr}|${hour}`;
    flashDrop(hourKey);
    const newDue = new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`).toISOString();
    updateTask(taskId, { dueDate: newDue });
  }, [updateTask, flashDrop]);

  const handleDropOnDay = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverHour(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    flashDrop(`month-${dateStr}`);
    const newDue = new Date(dateStr + "T00:00:00").toISOString();
    updateTask(taskId, { dueDate: newDue });
  }, [updateTask, flashDrop]);

  const filteredTasks = getFilteredTasks();
  const tasks = useMemo(() => {
    const parentIds = new Set(filteredTasks.map(t => t.id));
    const subtasks = allTasks.filter(t => t.parentTaskId && !parentIds.has(t.id) && t.status !== "done");
    return [...filteredTasks, ...subtasks].filter(t => t.status !== "done");
  }, [allTasks, filteredTasks]);

  const calEvents = calSync?.events ?? [];
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  /* ── Tasks indexed by date ── */
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.dueDate) return;
      const dk = t.dueDate.slice(0, 10);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk)!.push(t);
    });
    return map;
  }, [tasks]);

  /* ── External events indexed by date ── */
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calEvents.forEach(ev => {
      if (!ev.start_time) return;
      const dk = ev.start_time.slice(0, 10);
      if (!map.has(dk)) map.set(dk, []);
      map.get(dk)!.push(ev);
    });
    return map;
  }, [calEvents]);

  /* ── Navigation ── */
  const goNext = () => {
    if (mode === "month") setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    else if (mode === "week") setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });
    else setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() + 1); return n; });
  };
  const goPrev = () => {
    if (mode === "month") setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    else if (mode === "week") setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
    else setCurrentDate(d => { const n = new Date(d); n.setDate(d.getDate() - 1); return n; });
  };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDay(new Date()); };

  /* ── Month grid ── */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startDay = firstDay.getDay() - 1; if (startDay < 0) startDay = 6;
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    for (let i = startDay - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), isCurrentMonth: false });
    for (let i = 1; i <= lastDay.getDate(); i++) days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    return days;
  }, [year, month]);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  /* ── Tasks & events for a day ── */
  const tasksForDay = (day: Date) => tasksByDate.get(toDateStr(day)) || [];
  const eventsForDay = (day: Date) => eventsByDate.get(toDateStr(day)) || [];

  /* ── Add task ── */
  const handleAddTask = (dateStr: string, hour?: number) => {
    if (!newTaskTitle.trim()) return;
    const lists = selectedProjectId ? getListsForProject(selectedProjectId) : [];
    const listId = lists[0]?.id || "l1";
    const dueDate = hour != null
      ? new Date(`${dateStr}T${String(hour).padStart(2, "0")}:00:00`).toISOString()
      : new Date(dateStr + "T00:00:00").toISOString();
    addTask({
      title: newTaskTitle.trim(), description: "", status: "todo", priority: "normal",
      dueDate, startDate: null,
      assigneeIds: [], tags: [], parentTaskId: null, listId,
      comments: [], attachments: [], timeEstimate: null, timeLogged: null, aiSummary: null,
    });
    setNewTaskTitle("");
    setAddingForDate(null);
    setAddingForHour(null);
  };

  const handleSaveEvent = async (data: any) => {
    await calSync.createCalendarEvent(data);
  };

  /* ── Title ── */
  const title = mode === "month"
    ? `${MONTHS_FR[month]} ${year}`
    : mode === "week"
    ? (() => { const wk = getWeekDays(currentDate); return `${wk[0].getDate()} – ${wk[6].getDate()} ${MONTHS_FR[wk[6].getMonth()]} ${wk[6].getFullYear()}`; })()
    : `${DAYS_FR_FULL[getFrDayIndex(currentDate)]} ${currentDate.getDate()} ${MONTHS_FR[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  /* ── Render task pill ── */
  const renderTaskPill = (t: Task, compact = false) => {
    const pc = priorityColor(t.priority);
    return (
      <div
        key={t.id}
        draggable
        onDragStart={e => handleDragStart(e, t.id)}
        onClick={e => { e.stopPropagation(); setSelectedTaskId(t.id); }}
        style={{
          background: pc.bg, borderRadius: compact ? 4 : 6,
          padding: compact ? "2px 5px" : "3px 7px",
          fontSize: compact ? 8 : 9, color: pc.text, fontWeight: 600,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          cursor: "grab", marginBottom: 2,
          boxShadow: t.priority === "low" ? raisedSm : undefined,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {t.title}
      </div>
    );
  };

  /* ── Render event pill ── */
  const renderEventPill = (ev: CalendarEvent, compact = false) => (
    <div
      key={ev.id}
      style={{
        background: "rgba(42,88,40,0.12)", borderRadius: compact ? 4 : 6,
        padding: compact ? "2px 5px" : "3px 7px", fontSize: compact ? 8 : 9,
        color: C.green, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis",
        whiteSpace: "nowrap", marginBottom: 2, fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {ev.title}
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.text, height: "100%", display: "flex", flexDirection: "column" }}>

      {/* ═══ Toolbar ═══ */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px", background: BG, borderRadius: 14,
        boxShadow: raised, marginBottom: 16, flexWrap: "wrap", gap: 10,
      }}>
        {/* Left: nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <NmBtn onClick={goPrev}>‹</NmBtn>
          <span style={{ fontSize: 16, fontWeight: 700, color: C.text, minWidth: 180, textAlign: "center", textTransform: "capitalize" }}>
            {title}
          </span>
          <NmBtn onClick={goNext}>›</NmBtn>
          <NmBtn onClick={goToday} accent>Aujourd'hui</NmBtn>
        </div>

        {/* Right: mode + event */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Mode switcher */}
          <div style={{ background: BG, borderRadius: 10, boxShadow: inset, padding: 3, display: "flex", gap: 2 }}>
            {(["day", "week", "month"] as CalMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? BG : "transparent", border: "none", borderRadius: 7,
                  cursor: "pointer", color: mode === m ? C.orange : C.text,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: mode === m ? 700 : 500,
                  padding: "5px 12px", boxShadow: mode === m ? raisedSm : "none",
                  transition: "all .15s ease",
                }}
              >
                {m === "day" ? "Jour" : m === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>

          {mode !== "month" && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <NmBtn onClick={() => setHourHeight(prev => Math.min(200, prev + 16))}>+</NmBtn>
              <span style={{ fontSize: 9, color: C.muted, fontWeight: 600, minWidth: 28, textAlign: "center" }}>
                {Math.round((hourHeight / 64) * 100)}%
              </span>
              <NmBtn onClick={() => setHourHeight(prev => Math.max(32, prev - 16))}>−</NmBtn>
            </div>
          )}

          <NmBtn accent onClick={() => { setEventDialogDate(toDateStr(selectedDay)); setEventDialogOpen(true); }}>
            + Événement
          </NmBtn>
        </div>
      </div>

      {/* ═══ Month View ═══ */}
      {mode === "month" && (
        <div style={{ background: BG, borderRadius: 14, boxShadow: raised, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Day headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {DAYS_FR.map((d, i) => (
              <div key={i} style={{
                padding: "10px 0", textAlign: "center", fontSize: 10, fontWeight: 700,
                color: i >= 5 ? C.red : C.muted, textTransform: "uppercase", letterSpacing: 1,
                borderBottom: `1px solid ${C.border}`,
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1, borderBottom: wi < 5 ? `1px solid ${C.border}` : "none" }}>
                {calendarDays.slice(wi * 7, wi * 7 + 7).map((day, di) => {
                  const dayTasks = tasksForDay(day.date);
                  const dayEvents = eventsForDay(day.date);
                  const today_ = isToday(day.date);
                  const selected = isSameDay(day.date, selectedDay);
                  const dateStr = toDateStr(day.date);

                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDay(day.date)}
                      onDragOver={e => { e.preventDefault(); setDragOverHour(`month-${dateStr}`); }}
                      onDragLeave={() => setDragOverHour(null)}
                      onDrop={e => handleDropOnDay(e, dateStr)}
                      style={{
                        padding: "6px 8px", minHeight: 90, cursor: "pointer",
                        borderRight: di < 6 ? `1px solid ${C.border}` : "none",
                        background: droppedHour === `month-${dateStr}` ? "rgba(107,143,106,0.18)" : dragOverHour === `month-${dateStr}` ? "rgba(184,116,64,0.08)" : today_ ? "rgba(107,143,106,0.06)" : selected ? "rgba(184,116,64,0.04)" : "transparent",
                        transition: "background .35s ease",
                      }}
                    >
                      {/* Day number */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: today_ ? "#FFF" : !day.isCurrentMonth ? "#C0B8A8" : di >= 5 ? C.red : C.text,
                          background: today_ ? C.green : "transparent",
                          borderRadius: today_ ? "50%" : 0,
                          width: today_ ? 22 : "auto", height: today_ ? 22 : "auto",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {day.date.getDate()}
                        </span>
                        {day.isCurrentMonth && (
                          <span
                            onClick={e => { e.stopPropagation(); setAddingForDate(dateStr); }}
                            style={{
                              fontSize: 14, color: C.orange, cursor: "pointer", fontWeight: 700,
                              opacity: 0, transition: "opacity .15s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={e => (e.currentTarget.style.opacity = "0")}
                          >
                            +
                          </span>
                        )}
                      </div>

                      {/* Events */}
                      {dayEvents.slice(0, 1).map(ev => renderEventPill(ev, true))}

                      {/* Tasks */}
                      {dayTasks.slice(0, 2).map(t => renderTaskPill(t, true))}
                      {dayTasks.length > 2 && (
                        <div style={{ fontSize: 8, color: C.muted, fontWeight: 600, paddingLeft: 4 }}>
                          +{dayTasks.length - 2}
                        </div>
                      )}

                      {/* Quick add */}
                      {addingForDate === dateStr && (
                        <div onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleAddTask(dateStr); if (e.key === "Escape") setAddingForDate(null); }}
                            onBlur={() => { if (newTaskTitle.trim()) handleAddTask(dateStr); else { setAddingForDate(null); setNewTaskTitle(""); } }}
                            placeholder="Tâche…"
                            style={{
                              width: "100%", border: "none", background: BG, boxShadow: insetSm,
                              borderRadius: 6, padding: "3px 6px", fontSize: 9, color: C.text,
                              fontFamily: "'DM Sans', sans-serif", outline: "none", marginTop: 3,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Week View ═══ */}
      {mode === "week" && (
        <div style={{ background: BG, borderRadius: 14, boxShadow: raised, overflow: "hidden", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header row */}
          <div style={{ display: "grid", gridTemplateColumns: "50px repeat(7, 1fr)", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ padding: 8 }} />
            {weekDays.map((day, i) => {
              const today_ = isToday(day);
              return (
                <div key={i} style={{
                  padding: "10px 6px", textAlign: "center",
                  borderLeft: `1px solid ${C.border}`,
                  background: today_ ? "rgba(107,143,106,0.06)" : "transparent",
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: i >= 5 ? C.red : C.muted, textTransform: "uppercase", letterSpacing: 1 }}>
                    {DAYS_FR[i]}
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 700, marginTop: 2,
                    color: today_ ? "#FFF" : C.text,
                    background: today_ ? C.green : "transparent",
                    borderRadius: "50%", width: 28, height: 28,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {day.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hour rows */}
          <div style={{ flex: 1, overflowY: "auto" }} onWheel={handleWheel}>
            {HOURS.map(h => (
              <div key={h} style={{ display: "grid", gridTemplateColumns: "50px repeat(7, 1fr)", borderBottom: `1px solid ${C.border}`, minHeight: hourHeight * 0.8, transition: "min-height .1s ease" }}>
                <div style={{ padding: "4px 8px", fontSize: 10, color: C.muted, fontWeight: 600, textAlign: "right" }}>
                  {h}h
                </div>
                {weekDays.map((day, di) => {
                  const hourTasks = tasksForDay(day).filter(t => {
                    if (!t.dueDate) return false;
                    try { return new Date(t.dueDate).getHours() === h; } catch { return false; }
                  });
                  const hourEvents = eventsForDay(day).filter(e => {
                    if (!e.start_time) return false;
                    try { return new Date(e.start_time).getHours() === h; } catch { return false; }
                  });
                  const hourKey = `${toDateStr(day)}|${h}`;
                  return (
                    <div key={di}
                      onDragOver={e => { e.preventDefault(); setDragOverHour(hourKey); }}
                      onDragLeave={() => setDragOverHour(null)}
                      onDrop={e => handleDropOnHour(e, toDateStr(day), h)}
                      style={{
                        padding: "2px 4px", borderLeft: `1px solid ${C.border}`, position: "relative",
                        background: droppedHour === hourKey ? "rgba(107,143,106,0.18)" : dragOverHour === hourKey ? "rgba(184,116,64,0.08)" : "transparent",
                        transition: "background .35s ease",
                      }}
                      className="nm-hour-cell"
                    >
                      {hourEvents.map(ev => renderEventPill(ev))}
                      {hourTasks.map(t => renderTaskPill(t))}
                      {addingForHour === hourKey ? (
                        <div onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleAddTask(toDateStr(day), h); if (e.key === "Escape") { setAddingForHour(null); setNewTaskTitle(""); } }}
                            onBlur={() => { if (newTaskTitle.trim()) handleAddTask(toDateStr(day), h); else { setAddingForHour(null); setNewTaskTitle(""); } }}
                            placeholder="Tâche…"
                            style={{ width: "100%", border: "none", background: BG, boxShadow: insetSm, borderRadius: 5, padding: "2px 5px", fontSize: 8, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                          />
                        </div>
                      ) : (
                        <span
                          className="nm-add-task-btn"
                          onClick={e => { e.stopPropagation(); setAddingForHour(hourKey); setNewTaskTitle(""); }}
                          style={{ position: "absolute", bottom: 1, right: 3, fontSize: 8, color: C.orange, cursor: "pointer", fontWeight: 700, opacity: 0, transition: "opacity .15s", fontFamily: "'DM Sans', sans-serif" }}
                        >+ tâche</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Day View ═══ */}
      {mode === "day" && (
        <div style={{ background: BG, borderRadius: 14, boxShadow: raised, overflow: "hidden", flex: 1, display: "flex" }}>
          {/* Hour labels */}
          <div style={{ width: 56, flexShrink: 0, borderRight: `1px solid ${C.border}` }}>
            {HOURS.map(h => (
              <div key={h} style={{
                height: hourHeight, padding: "4px 8px", fontSize: 10, color: C.muted,
                fontWeight: 600, textAlign: "right", borderBottom: `1px solid ${C.border}`,
                transition: "height .1s ease",
              }}>
                {h}h
              </div>
            ))}
          </div>

          {/* Events column */}
          <div style={{ flex: 1, position: "relative", overflowY: "auto" }} onWheel={handleWheel}>
            {/* Now line */}
            {isToday(currentDate) && (() => {
              const now = new Date();
              const minutesSince7 = (now.getHours() - 7) * 60 + now.getMinutes();
              const totalMinutes = HOURS.length * 60;
              const pct = Math.max(0, Math.min(1, minutesSince7 / totalMinutes));
              return (
                <div style={{
                  position: "absolute", top: `${pct * 100}%`, left: 0, right: 0,
                  height: 2, background: C.red, zIndex: 10, opacity: 0.7,
                }}>
                  <div style={{
                    position: "absolute", left: -4, top: -3, width: 8, height: 8,
                    borderRadius: "50%", background: C.red,
                  }} />
                </div>
              );
            })()}

            {HOURS.map(h => {
              const hourTasks = tasksForDay(currentDate).filter(t => {
                if (!t.dueDate) return h === 9;
                try { return new Date(t.dueDate).getHours() === h; } catch { return false; }
              });
              const hourEvents = eventsForDay(currentDate).filter(e => {
                if (!e.start_time) return false;
                try { return new Date(e.start_time).getHours() === h; } catch { return false; }
              });
              const dayDateStr = toDateStr(currentDate);
              const hourKey = `${dayDateStr}|${h}`;
              return (
                <div key={h}
                  onDragOver={e => { e.preventDefault(); setDragOverHour(hourKey); }}
                  onDragLeave={() => setDragOverHour(null)}
                  onDrop={e => handleDropOnHour(e, dayDateStr, h)}
                  style={{
                    height: hourHeight, padding: "4px 12px", borderBottom: `1px solid ${C.border}`,
                    transition: "height .1s ease, background .35s ease", position: "relative",
                    background: droppedHour === hourKey ? "rgba(107,143,106,0.18)" : dragOverHour === hourKey ? "rgba(184,116,64,0.08)" : "transparent",
                  }}
                  className="nm-hour-cell"
                >
                  {hourEvents.map(ev => (
                    <div key={ev.id} style={{
                      background: "rgba(107,143,106,0.12)", borderRadius: 8, borderLeft: `3px solid ${C.green}`,
                      padding: "5px 10px", marginBottom: 3, fontFamily: "'DM Sans', sans-serif",
                    }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.green }}>{ev.title}</div>
                      <div style={{ fontSize: 8, color: C.muted }}>{h}h00</div>
                    </div>
                  ))}
                  {hourTasks.map(t => {
                    const pc = priorityColor(t.priority);
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTaskId(t.id)}
                        style={{
                          background: pc.bg, borderRadius: 8, borderLeft: `3px solid ${pc.bg === BG ? C.muted : pc.bg}`,
                          padding: "5px 10px", fontSize: 10, color: pc.text,
                          fontWeight: 600, cursor: "pointer", marginBottom: 3,
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        <div>{t.title}</div>
                        <div style={{ fontSize: 8, opacity: 0.7 }}>{h}h00</div>
                      </div>
                    );
                  })}
                  {addingForHour === hourKey ? (
                    <div onClick={e => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleAddTask(dayDateStr, h); if (e.key === "Escape") { setAddingForHour(null); setNewTaskTitle(""); } }}
                        onBlur={() => { if (newTaskTitle.trim()) handleAddTask(dayDateStr, h); else { setAddingForHour(null); setNewTaskTitle(""); } }}
                        placeholder="Tâche…"
                        style={{ width: "100%", border: "none", background: BG, boxShadow: insetSm, borderRadius: 6, padding: "3px 7px", fontSize: 9, color: C.text, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
                      />
                    </div>
                  ) : (
                    <span
                      className="nm-add-task-btn"
                      onClick={e => { e.stopPropagation(); setAddingForHour(hourKey); setNewTaskTitle(""); }}
                      style={{ position: "absolute", bottom: 2, right: 6, fontSize: 9, color: C.orange, cursor: "pointer", fontWeight: 700, opacity: 0, transition: "opacity .15s", fontFamily: "'DM Sans', sans-serif" }}
                    >+ tâche</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ Event Dialog ═══ */}
      {eventDialogOpen && (
        <CalendarEventDialog
          open={eventDialogOpen}
          onClose={() => setEventDialogOpen(false)}
          onSave={handleSaveEvent}
          defaultDate={eventDialogDate}
        />
      )}
    </div>
  );
}
