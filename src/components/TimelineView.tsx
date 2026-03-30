import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { Task } from "@/types";
import {
  addDays,
  differenceInDays,
  startOfDay,
  format,
  isWeekend,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getWeek,
  startOfWeek,
  addMonths,
  isSameDay,
  isWithinInterval,
} from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Layers,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type ZoomLevel = "day" | "week" | "month";
type GroupBy = "none" | "assignee" | "project" | "status";

const LANE_HEIGHT = 32;
const LANE_GAP = 4;
const HEADER_HEIGHT = 56;
const GROUP_HEADER_HEIGHT = 36;

const STATUS_COLORS: Record<string, string> = {
  todo: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--primary))",
  in_review: "hsl(var(--accent-foreground))",
  done: "hsl(var(--chart-2))",
  blocked: "hsl(var(--destructive))",
};

function getPixelsPerDay(zoom: ZoomLevel): number {
  switch (zoom) {
    case "day": return 40;
    case "week": return 12;
    case "month": return 4;
  }
}

interface SwimLane {
  endDay: number;
}

function assignLane(
  taskStart: number,
  taskEnd: number,
  lanes: SwimLane[]
): number {
  for (let i = 0; i < lanes.length; i++) {
    if (taskStart > lanes[i].endDay) {
      lanes[i].endDay = taskEnd;
      return i;
    }
  }
  lanes.push({ endDay: taskEnd });
  return lanes.length - 1;
}

interface TimelineTask {
  task: Task;
  startDay: number;
  endDay: number;
  lane: number;
  hasOverlap: boolean;
}

interface TaskGroup {
  id: string;
  label: string;
  color?: string;
  items: TimelineTask[];
  laneCount: number;
}

export default function TimelineView() {
  const { tasks, projects, taskLists, teamMembers, setSelectedTaskId, getFilteredTasks } = useApp();
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [showOverlapsOnly, setShowOverlapsOnly] = useState(false);

  const filteredTasks = useMemo(() => getFilteredTasks(), [getFilteredTasks]);

  const today = useMemo(() => startOfDay(new Date()), []);

  // Compute range
  const { rangeStart, rangeEnd } = useMemo(() => {
    const datedTasks = filteredTasks.filter(t => t.startDate || t.dueDate);
    if (datedTasks.length === 0) {
      return { rangeStart: addDays(today, -30), rangeEnd: addDays(today, 60) };
    }
    let min = today;
    let max = today;
    datedTasks.forEach(t => {
      const s = t.startDate ? startOfDay(new Date(t.startDate)) : (t.dueDate ? startOfDay(new Date(t.dueDate)) : today);
      const e = t.dueDate ? startOfDay(new Date(t.dueDate)) : addDays(s, 1);
      if (s < min) min = s;
      if (e > max) max = e;
    });
    return {
      rangeStart: addDays(min, -14),
      rangeEnd: addDays(max, 14),
    };
  }, [filteredTasks, today]);

  const ppd = getPixelsPerDay(zoom);
  const totalDays = differenceInDays(rangeEnd, rangeStart);
  const totalWidth = totalDays * ppd;

  // Build timeline tasks
  const timelineTasks = useMemo(() => {
    return filteredTasks
      .filter(t => t.startDate || t.dueDate)
      .map(t => {
        const s = t.startDate ? startOfDay(new Date(t.startDate)) : (t.dueDate ? startOfDay(new Date(t.dueDate)) : today);
        const e = t.dueDate ? startOfDay(new Date(t.dueDate)) : addDays(s, t.durationDays || 1);
        return {
          task: t,
          startDay: differenceInDays(s, rangeStart),
          endDay: differenceInDays(e, rangeStart),
        };
      })
      .sort((a, b) => a.startDay - b.startDay || (b.endDay - b.startDay) - (a.endDay - a.startDay));
  }, [filteredTasks, rangeStart, today]);

  // Detect overlaps
  const overlappingTaskIds = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < timelineTasks.length; i++) {
      for (let j = i + 1; j < timelineTasks.length; j++) {
        const a = timelineTasks[i];
        const b = timelineTasks[j];
        if (b.startDay < a.endDay && a.startDay < b.endDay) {
          ids.add(a.task.id);
          ids.add(b.task.id);
        }
      }
    }
    return ids;
  }, [timelineTasks]);

  // Group tasks
  const groups = useMemo((): TaskGroup[] => {
    const filtered = showOverlapsOnly
      ? timelineTasks.filter(t => overlappingTaskIds.has(t.task.id))
      : timelineTasks;

    const buildGroup = (
      id: string,
      label: string,
      items: typeof filtered,
      color?: string
    ): TaskGroup => {
      const lanes: SwimLane[] = [];
      const layoutItems: TimelineTask[] = items.map(t => {
        const lane = assignLane(t.startDay, t.endDay, lanes);
        return {
          ...t,
          lane,
          hasOverlap: overlappingTaskIds.has(t.task.id),
        };
      });
      return { id, label, color, items: layoutItems, laneCount: Math.max(lanes.length, 1) };
    };

    if (groupBy === "none") {
      return [buildGroup("all", "Toutes les tâches", filtered)];
    }

    if (groupBy === "assignee") {
      const byAssignee = new Map<string, typeof filtered>();
      const unassigned: typeof filtered = [];
      filtered.forEach(t => {
        if (t.task.assigneeIds.length === 0) {
          unassigned.push(t);
        } else {
          t.task.assigneeIds.forEach(aid => {
            if (!byAssignee.has(aid)) byAssignee.set(aid, []);
            byAssignee.get(aid)!.push(t);
          });
        }
      });
      const groups: TaskGroup[] = [];
      byAssignee.forEach((items, aid) => {
        const member = teamMembers.find(m => m.id === aid);
        groups.push(buildGroup(aid, member?.name || "Inconnu", items, member?.avatarColor));
      });
      if (unassigned.length > 0) {
        groups.push(buildGroup("unassigned", "Non assigné", unassigned));
      }
      return groups;
    }

    if (groupBy === "project") {
      const byProject = new Map<string, typeof filtered>();
      filtered.forEach(t => {
        const list = taskLists.find(l => l.id === t.task.listId);
        const pid = list?.projectId || "unknown";
        if (!byProject.has(pid)) byProject.set(pid, []);
        byProject.get(pid)!.push(t);
      });
      const groups: TaskGroup[] = [];
      byProject.forEach((items, pid) => {
        const proj = projects.find(p => p.id === pid);
        groups.push(buildGroup(pid, proj?.name || "Projet inconnu", items, proj?.color));
      });
      return groups;
    }

    if (groupBy === "status") {
      const byStatus = new Map<string, typeof filtered>();
      filtered.forEach(t => {
        const s = t.task.status;
        if (!byStatus.has(s)) byStatus.set(s, []);
        byStatus.get(s)!.push(t);
      });
      const groups: TaskGroup[] = [];
      byStatus.forEach((items, status) => {
        groups.push(buildGroup(status, status.replace(/_/g, " "), items));
      });
      return groups;
    }

    return [buildGroup("all", "Toutes les tâches", filtered)];
  }, [timelineTasks, groupBy, showOverlapsOnly, overlappingTaskIds, teamMembers, projects, taskLists]);

  // Column headers
  const columns = useMemo(() => {
    const cols: { label: string; subLabel?: string; width: number; isToday: boolean; isWeekend: boolean }[] = [];
    if (zoom === "day") {
      const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
      days.forEach(d => cols.push({
        label: format(d, "dd", { locale: fr }),
        subLabel: format(d, "EEE", { locale: fr }),
        width: ppd,
        isToday: isSameDay(d, today),
        isWeekend: isWeekend(d),
      }));
    } else if (zoom === "week") {
      const weeks = eachWeekOfInterval({ start: rangeStart, end: rangeEnd }, { weekStartsOn: 1 });
      weeks.forEach(w => cols.push({
        label: `S${getWeek(w)}`,
        subLabel: format(w, "dd MMM", { locale: fr }),
        width: 7 * ppd,
        isToday: isWithinInterval(today, { start: w, end: addDays(w, 6) }),
        isWeekend: false,
      }));
    } else {
      const months = eachMonthOfInterval({ start: rangeStart, end: rangeEnd });
      months.forEach(m => {
        const daysInMonth = differenceInDays(addMonths(m, 1), m);
        cols.push({
          label: format(m, "MMM yyyy", { locale: fr }),
          width: daysInMonth * ppd,
          isToday: today.getMonth() === m.getMonth() && today.getFullYear() === m.getFullYear(),
          isWeekend: false,
        });
      });
    }
    return cols;
  }, [zoom, rangeStart, rangeEnd, ppd, today]);

  // Scroll to today on mount/zoom change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!timelineRef.current) return;
      const todayPx = differenceInDays(today, rangeStart) * ppd;
      timelineRef.current.scrollLeft = Math.max(0, todayPx - 300);
    }, 100);
    return () => clearTimeout(timer);
  }, [zoom, rangeStart, ppd, today]);

  // Today line position
  const todayX = differenceInDays(today, rangeStart) * ppd;

  // Overlap stats
  const overlapCount = overlappingTaskIds.size;

  const getTaskColor = (task: Task): string => {
    if (task.color) return task.color;
    return STATUS_COLORS[task.status] || "hsl(var(--primary))";
  };

  const getProgress = (task: Task): number => {
    if (task.progress != null && task.progress > 0) return task.progress;
    switch (task.status) {
      case "done": return 100;
      case "in_review": return 75;
      case "in_progress": return 50;
      default: return 0;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => timelineRef.current && (timelineRef.current.scrollLeft -= 300)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (!timelineRef.current) return;
              const todayPx = differenceInDays(today, rangeStart) * ppd;
              timelineRef.current.scrollLeft = Math.max(0, todayPx - 300);
            }}
            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-muted text-foreground"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => timelineRef.current && (timelineRef.current.scrollLeft += 300)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {(["day", "week", "month"] as ZoomLevel[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                zoom === z ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {z === "day" ? "Jour" : z === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>

        {/* Group by */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted text-muted-foreground">
              <Layers className="w-3.5 h-3.5" />
              Grouper
              {groupBy !== "none" && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                  {groupBy === "assignee" ? "Membre" : groupBy === "project" ? "Projet" : "Statut"}
                </Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            {([
              { key: "none", label: "Aucun" },
              { key: "assignee", label: "Par membre" },
              { key: "project", label: "Par projet" },
              { key: "status", label: "Par statut" },
            ] as { key: GroupBy; label: string }[]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setGroupBy(opt.key)}
                className={`w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted ${
                  groupBy === opt.key ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Overlap filter */}
        <button
          onClick={() => setShowOverlapsOnly(!showOverlapsOnly)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            showOverlapsOnly
              ? "bg-destructive/10 text-destructive font-medium"
              : "hover:bg-muted text-muted-foreground"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Chevauchements
          {overlapCount > 0 && (
            <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[10px]">
              {overlapCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Timeline */}
      <div ref={timelineRef} className="flex-1 overflow-auto">
        <div style={{ width: Math.max(totalWidth, 800), minHeight: "100%" }} className="relative">
          {/* Header */}
          <div
            className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border flex"
            style={{ height: HEADER_HEIGHT }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                className={`shrink-0 border-r border-border/30 flex flex-col items-center justify-end pb-1 text-[10px] ${
                  col.isToday ? "bg-primary/10" : col.isWeekend ? "bg-muted/60" : ""
                }`}
                style={{ width: col.width }}
              >
                <span className={`font-medium ${col.isToday ? "text-primary" : "text-muted-foreground"}`}>
                  {col.label}
                </span>
                {col.subLabel && (
                  <span className="text-muted-foreground/60">{col.subLabel}</span>
                )}
              </div>
            ))}
          </div>

          {/* Today line */}
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: todayX,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: "hsl(var(--destructive))",
            }}
          >
            <div
              className="absolute -left-[5px] rounded-full"
              style={{
                top: HEADER_HEIGHT - 6,
                width: 12,
                height: 12,
                backgroundColor: "hsl(var(--destructive))",
                borderRadius: "50%",
              }}
            />
          </div>

          {/* Groups */}
          <div className="relative">
            {groups.map((group, gi) => {
              const groupTopOffset = groups.slice(0, gi).reduce((acc, g) => {
                return acc + (groupBy !== "none" ? GROUP_HEADER_HEIGHT : 0) + g.laneCount * (LANE_HEIGHT + LANE_GAP) + 16;
              }, 0);

              return (
                <div key={group.id} className="relative" style={{ marginTop: gi > 0 ? 8 : 0 }}>
                  {/* Group header */}
                  {groupBy !== "none" && (
                    <div
                      className="sticky left-0 z-[5] flex items-center gap-2 px-4 border-b border-border/30 bg-muted/40 backdrop-blur-sm"
                      style={{ height: GROUP_HEADER_HEIGHT }}
                    >
                      {group.color && (
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                      )}
                      <span className="text-xs font-semibold text-foreground capitalize">{group.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {group.items.length} tâche{group.items.length > 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  {/* Lanes */}
                  <div
                    className="relative"
                    style={{
                      height: group.laneCount * (LANE_HEIGHT + LANE_GAP) + 8,
                      minHeight: LANE_HEIGHT + 16,
                    }}
                  >
                    {/* Lane grid lines */}
                    {Array.from({ length: group.laneCount }).map((_, li) => (
                      <div
                        key={li}
                        className="absolute left-0 right-0 border-b border-border/10"
                        style={{
                          top: 4 + li * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT + LANE_GAP / 2,
                        }}
                      />
                    ))}

                    {/* Task bars */}
                    {group.items.map(item => {
                      const left = item.startDay * ppd;
                      const width = Math.max((item.endDay - item.startDay) * ppd, 6);
                      const top = 4 + item.lane * (LANE_HEIGHT + LANE_GAP);
                      const color = getTaskColor(item.task);
                      const progress = getProgress(item.task);

                      return (
                        <Tooltip key={item.task.id}>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute rounded-md cursor-pointer transition-all hover:shadow-lg hover:z-10 group/bar ${
                                item.hasOverlap
                                  ? "ring-1 ring-destructive/40"
                                  : ""
                              }`}
                              style={{
                                left,
                                top,
                                width,
                                height: LANE_HEIGHT,
                                backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
                                borderLeft: `3px solid ${color}`,
                              }}
                              onClick={() => setSelectedTaskId(item.task.id)}
                            >
                              {/* Progress fill */}
                              <div
                                className="absolute inset-0 rounded-r-md pointer-events-none"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                                  borderRadius: progress >= 100 ? "0 6px 6px 0" : undefined,
                                }}
                              />
                              {/* Label */}
                              {width > 50 && (
                                <div className="absolute inset-0 flex items-center px-2 gap-1.5 overflow-hidden">
                                  <span
                                    className="text-[11px] font-medium truncate"
                                    style={{ color }}
                                  >
                                    {item.task.title}
                                  </span>
                                  {progress > 0 && width > 100 && (
                                    <span className="text-[9px] text-muted-foreground shrink-0">
                                      {progress}%
                                    </span>
                                  )}
                                </div>
                              )}
                              {/* Overlap indicator */}
                              {item.hasOverlap && (
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive z-10" />
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="text-xs space-y-0.5">
                              <div className="font-semibold">{item.task.title}</div>
                              <div className="text-muted-foreground">
                                {item.task.startDate
                                  ? format(new Date(item.task.startDate), "dd MMM yyyy", { locale: fr })
                                  : "—"}{" "}
                                →{" "}
                                {item.task.dueDate
                                  ? format(new Date(item.task.dueDate), "dd MMM yyyy", { locale: fr })
                                  : "—"}
                              </div>
                              <div className="text-muted-foreground">
                                Progression : {progress}%
                              </div>
                              {item.hasOverlap && (
                                <div className="text-destructive font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Chevauchement détecté
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {timelineTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Calendar className="w-12 h-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">Aucune tâche avec des dates</p>
              <p className="text-xs mt-1">Ajoutez des dates de début/fin à vos tâches pour les voir ici</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-4 h-1 rounded-full bg-primary inline-block" /> Tâche
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive inline-block" /> Chevauchement
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-destructive inline-block" /> Aujourd'hui
        </span>
        {overlapCount > 0 && (
          <span className="ml-auto text-destructive font-medium">
            {overlapCount} tâche{overlapCount > 1 ? "s" : ""} en chevauchement
          </span>
        )}
      </div>
    </div>
  );
}
