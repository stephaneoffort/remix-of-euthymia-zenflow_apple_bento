import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Task, TaskDependency } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRightIcon,
  Diamond,
  Eye,
  Group,
  Filter,
  Download,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  addDays,
  differenceInDays,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  endOfDay,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  format,
  isSameDay,
  isWeekend,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  getWeek,
  addWeeks,
  addMonths,
  addQuarters,
  isWithinInterval,
} from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type ZoomLevel = "day" | "week" | "month" | "quarter";

const ZOOM_CONFIG: Record<ZoomLevel, { colWidth: number; label: string }> = {
  day: { colWidth: 30, label: "Jour" },
  week: { colWidth: 60, label: "Sem" },
  month: { colWidth: 120, label: "Mois" },
  quarter: { colWidth: 200, label: "Trim" },
};

const ROW_HEIGHT = 36;
const LIST_WIDTH = 300;

// French holidays (fixed dates)
const FRENCH_HOLIDAYS_FIXED = [
  { month: 1, day: 1, name: "Jour de l'An" },
  { month: 5, day: 1, name: "Fête du Travail" },
  { month: 5, day: 8, name: "Victoire 1945" },
  { month: 7, day: 14, name: "Fête nationale" },
  { month: 8, day: 15, name: "Assomption" },
  { month: 11, day: 1, name: "Toussaint" },
  { month: 11, day: 11, name: "Armistice" },
  { month: 12, day: 25, name: "Noël" },
];

function isHoliday(date: Date): string | null {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = FRENCH_HOLIDAYS_FIXED.find((h) => h.month === m && h.day === d);
  return h ? h.name : null;
}

// ── CPM Algorithm ──
interface CpmResult {
  criticalTaskIds: string[];
  totalFloat: Record<string, number>;
}

function topologicalSort(taskIds: string[], deps: TaskDependency[]): string[] {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};
  taskIds.forEach((id) => {
    inDegree[id] = 0;
    adj[id] = [];
  });
  deps.forEach((d) => {
    if (adj[d.dependsOnId] && inDegree[d.taskId] !== undefined) {
      adj[d.dependsOnId].push(d.taskId);
      inDegree[d.taskId] = (inDegree[d.taskId] || 0) + 1;
    }
  });
  const queue = taskIds.filter((id) => inDegree[id] === 0);
  const sorted: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    sorted.push(n);
    for (const s of adj[n] || []) {
      inDegree[s]--;
      if (inDegree[s] === 0) queue.push(s);
    }
  }
  return sorted;
}

function computeCriticalPath(
  tasks: { id: string; startDate: Date; durationDays: number }[],
  deps: TaskDependency[]
): CpmResult {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const ids = tasks.map((t) => t.id);
  const order = topologicalSort(ids, deps);

  const es: Record<string, number> = {};
  const ef: Record<string, number> = {};

  const earliest = Math.min(...tasks.map((t) => t.startDate.getTime()));

  for (const id of order) {
    const t = taskMap.get(id)!;
    const preds = deps.filter((d) => d.taskId === id);
    if (preds.length === 0) {
      es[id] = differenceInDays(t.startDate, new Date(earliest));
    } else {
      es[id] = Math.max(...preds.map((p) => (ef[p.dependsOnId] ?? 0) + (p.lagDays || 0)));
    }
    ef[id] = es[id] + t.durationDays;
  }

  const projectEnd = Math.max(...Object.values(ef), 0);
  const ls: Record<string, number> = {};
  const lf: Record<string, number> = {};

  for (const id of [...order].reverse()) {
    const t = taskMap.get(id)!;
    const succs = deps.filter((d) => d.dependsOnId === id);
    if (succs.length === 0) {
      lf[id] = projectEnd;
    } else {
      lf[id] = Math.min(...succs.map((s) => (ls[s.taskId] ?? projectEnd) - (s.lagDays || 0)));
    }
    ls[id] = lf[id] - t.durationDays;
  }

  const totalFloat: Record<string, number> = {};
  const criticalTaskIds: string[] = [];
  for (const id of ids) {
    totalFloat[id] = (ls[id] ?? 0) - (es[id] ?? 0);
    if (Math.abs(totalFloat[id]) < 0.5) criticalTaskIds.push(id);
  }

  return { criticalTaskIds, totalFloat };
}

// ── WBS numbering ──
function assignWbs(tasks: Task[]): Map<string, string> {
  const wbsMap = new Map<string, string>();
  const roots = tasks.filter((t) => !t.parentTaskId);
  roots.forEach((root, i) => {
    const num = `${i + 1}`;
    wbsMap.set(root.id, num);
    const children = tasks.filter((t) => t.parentTaskId === root.id);
    children.forEach((child, j) => {
      wbsMap.set(child.id, `${num}.${j + 1}`);
    });
  });
  return wbsMap;
}

// ── Flatten tasks with hierarchy ──
interface FlatTask extends Task {
  level: number;
  wbsNumber: string;
  isExpanded: boolean;
  hasChildren: boolean;
}

export default function GanttView() {
  const { tasks, setSelectedTaskId, updateTask } = useApp();
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [showDeps, setShowDeps] = useState(true);
  const [showCritical, setShowCritical] = useState(true);
  const [showToday, setShowToday] = useState(true);
  const [showWeekends, setShowWeekends] = useState(true);
  const [showWbs, setShowWbs] = useState(true);
  const [showProgress, setShowProgress] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load dependencies
  useEffect(() => {
    supabase
      .from("task_dependencies")
      .select("*")
      .then(({ data }) => {
        if (data) {
          setDependencies(
            data.map((d: any) => ({
              id: d.id,
              taskId: d.task_id,
              dependsOnId: d.depends_on_id,
              type: d.type || "FS",
              lagDays: d.lag_days || 0,
            }))
          );
        }
      });
  }, []);

  const today = startOfDay(new Date());

  // WBS
  const wbsMap = useMemo(() => assignWbs(tasks), [tasks]);

  // Flatten tasks
  const flatTasks = useMemo<FlatTask[]>(() => {
    const result: FlatTask[] = [];
    const roots = tasks.filter((t) => !t.parentTaskId);
    const sortedRoots = [...roots].sort((a, b) => a.order - b.order);

    function addTask(task: Task, level: number) {
      const children = tasks.filter((t) => t.parentTaskId === task.id);
      const isExpanded = !collapsed.has(task.id);
      result.push({
        ...task,
        level,
        wbsNumber: wbsMap.get(task.id) || "",
        isExpanded,
        hasChildren: children.length > 0,
      });
      if (isExpanded) {
        children.sort((a, b) => a.order - b.order).forEach((c) => addTask(c, level + 1));
      }
    }

    sortedRoots.forEach((t) => addTask(t, 0));
    return result;
  }, [tasks, collapsed, wbsMap]);

  // Date range
  const { rangeStart, rangeEnd, columns } = useMemo(() => {
    const tasksWithDates = tasks.filter((t) => t.startDate || t.dueDate);
    if (tasksWithDates.length === 0) {
      const s = addDays(today, -7);
      const e = addDays(today, 60);
      return { rangeStart: s, rangeEnd: e, columns: generateColumns(s, e, zoom) };
    }

    let earliest = today;
    let latest = today;
    tasksWithDates.forEach((t) => {
      const sd = t.startDate ? new Date(t.startDate) : null;
      const ed = t.dueDate ? new Date(t.dueDate) : null;
      if (sd && sd < earliest) earliest = sd;
      if (ed && ed > latest) latest = ed;
      if (sd && !ed && sd > latest) latest = sd;
      if (ed && !sd && ed < earliest) earliest = ed;
    });

    const s = addDays(startOfDay(earliest), -7);
    const e = addDays(endOfDay(latest), 14);
    return { rangeStart: s, rangeEnd: e, columns: generateColumns(s, e, zoom) };
  }, [tasks, zoom, today]);

  // CPM
  const cpmResult = useMemo(() => {
    const cpmTasks = flatTasks
      .filter((t) => t.startDate && !t.isMilestone)
      .map((t) => ({
        id: t.id,
        startDate: new Date(t.startDate!),
        durationDays: t.durationDays || differenceInDays(
          t.dueDate ? new Date(t.dueDate) : addDays(new Date(t.startDate!), 1),
          new Date(t.startDate!)
        ) || 1,
      }));
    if (cpmTasks.length === 0) return { criticalTaskIds: [], totalFloat: {} };
    return computeCriticalPath(cpmTasks, dependencies);
  }, [flatTasks, dependencies]);

  // Scroll sync
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && listRef.current) {
      listRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);
  const handleListScroll = useCallback(() => {
    if (listRef.current && timelineRef.current) {
      timelineRef.current.scrollTop = listRef.current.scrollTop;
    }
  }, []);

  const toggleCollapse = (taskId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Navigate
  const [viewOffset, setViewOffset] = useState(0);
  const scrollToToday = () => {
    if (!timelineRef.current) return;
    const daysSinceStart = differenceInDays(today, rangeStart);
    const px = daysSinceStart * getPixelsPerDay(zoom) - 200;
    timelineRef.current.scrollLeft = Math.max(0, px);
  };

  useEffect(() => {
    const t = setTimeout(scrollToToday, 100);
    return () => clearTimeout(t);
  }, [zoom]);

  // Update progress
  const handleProgressChange = async (taskId: string, progress: number) => {
    updateTask(taskId, { progress } as any);
    await supabase.from("tasks").update({ progress }).eq("id", taskId);
  };

  const totalWidth = useMemo(() => {
    const days = differenceInDays(rangeEnd, rangeStart);
    return days * getPixelsPerDay(zoom);
  }, [rangeStart, rangeEnd, zoom]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <button onClick={() => timelineRef.current && (timelineRef.current.scrollLeft -= 200)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={scrollToToday} className="px-3 py-1 text-xs font-medium rounded-md hover:bg-muted text-foreground">
            Aujourd'hui
          </button>
          <button onClick={() => timelineRef.current && (timelineRef.current.scrollLeft += 200)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {(["day", "week", "month", "quarter"] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                zoom === z ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {ZOOM_CONFIG[z].label}
            </button>
          ))}
        </div>

        {/* Display options */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md hover:bg-muted text-muted-foreground">
              <Eye className="w-3.5 h-3.5" /> Afficher
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            {[
              { label: "Dépendances", checked: showDeps, set: setShowDeps },
              { label: "Chemin critique", checked: showCritical, set: setShowCritical },
              { label: "Aujourd'hui", checked: showToday, set: setShowToday },
              { label: "Week-ends", checked: showWeekends, set: setShowWeekends },
              { label: "N° WBS", checked: showWbs, set: setShowWbs },
              { label: "Progression", checked: showProgress, set: setShowProgress },
            ].map((opt) => (
              <label key={opt.label} className="flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted cursor-pointer">
                <input type="checkbox" checked={opt.checked} onChange={(e) => opt.set(e.target.checked)} className="rounded" />
                {opt.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left list */}
        <div className="shrink-0 border-r border-border" style={{ width: LIST_WIDTH }}>
          {/* List header */}
          <div className="h-12 flex items-center px-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
            <span className="w-10">{showWbs ? "N°" : ""}</span>
            <span className="flex-1">Titre</span>
            {showProgress && <span className="w-14 text-right">%</span>}
          </div>
          {/* List rows */}
          <div ref={listRef} className="overflow-y-auto overflow-x-hidden" style={{ height: "calc(100% - 48px)" }} onScroll={handleListScroll}>
            {flatTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center h-[${ROW_HEIGHT}px] px-3 text-xs border-b border-border/50 hover:bg-muted/30 cursor-pointer group ${
                  showCritical && cpmResult.criticalTaskIds.includes(task.id) ? "bg-destructive/5" : ""
                }`}
                style={{ height: ROW_HEIGHT }}
                onClick={() => setSelectedTaskId(task.id)}
              >
                <span className="w-10 text-muted-foreground shrink-0">
                  {showWbs ? task.wbsNumber : ""}
                </span>
                <div className="flex items-center gap-1 flex-1 min-w-0" style={{ paddingLeft: task.level * 16 }}>
                  {task.hasChildren && (
                    <button onClick={(e) => { e.stopPropagation(); toggleCollapse(task.id); }} className="p-0.5 hover:bg-muted rounded shrink-0">
                      {task.isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                    </button>
                  )}
                  {task.isMilestone && <Diamond className="w-3 h-3 text-primary shrink-0" />}
                  <span className="truncate text-foreground">{task.title}</span>
                </div>
                {showProgress && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="w-14 text-right text-muted-foreground hover:text-foreground shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {task.progress ?? 0}%
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-3" align="end">
                      <div className="text-xs font-medium mb-2">Progression</div>
                      <Slider
                        value={[task.progress ?? 0]}
                        max={100}
                        step={5}
                        onValueChange={([v]) => handleProgressChange(task.id, v)}
                      />
                      <div className="text-xs text-muted-foreground text-center mt-1">{task.progress ?? 0}%</div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div ref={timelineRef} className="flex-1 overflow-auto" onScroll={handleTimelineScroll}>
          <div style={{ width: totalWidth, minHeight: "100%" }} className="relative">
            {/* Timeline header */}
            <div className="h-12 sticky top-0 z-10 bg-muted/80 backdrop-blur-sm border-b border-border flex items-end">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className="shrink-0 border-r border-border/30 px-1 pb-1 text-[10px] text-muted-foreground"
                  style={{ width: col.width }}
                >
                  {col.label}
                </div>
              ))}
            </div>

            {/* Grid rows */}
            <div className="relative">
              {/* Weekend / holiday backgrounds */}
              {(zoom === "day" || zoom === "week") && showWeekends && (
                <WeekendOverlay rangeStart={rangeStart} rangeEnd={rangeEnd} zoom={zoom} rowCount={flatTasks.length} />
              )}

              {/* Today line */}
              {showToday && (
                <TodayLine today={today} rangeStart={rangeStart} zoom={zoom} rowCount={flatTasks.length} />
              )}

              {/* Task bars */}
              {flatTasks.map((task, rowIndex) => (
                <GanttBar
                  key={task.id}
                  task={task}
                  rowIndex={rowIndex}
                  rangeStart={rangeStart}
                  zoom={zoom}
                  isCritical={showCritical && cpmResult.criticalTaskIds.includes(task.id)}
                  totalFloat={cpmResult.totalFloat[task.id]}
                  onDoubleClick={() => setSelectedTaskId(task.id)}
                />
              ))}

              {/* Dependency arrows */}
              {showDeps && (
                <DependencyArrows
                  dependencies={dependencies}
                  flatTasks={flatTasks}
                  rangeStart={rangeStart}
                  zoom={zoom}
                  criticalTaskIds={showCritical ? cpmResult.criticalTaskIds : []}
                />
              )}

              {/* Row gridlines */}
              {flatTasks.map((_, i) => (
                <div
                  key={i}
                  className={`absolute left-0 right-0 border-b border-border/20 ${i % 2 === 1 ? "bg-muted/10" : ""}`}
                  style={{ top: 12 + i * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border text-[10px] text-muted-foreground shrink-0">
        <span className="flex items-center gap-1">
          <span className="w-4 h-1 rounded-full bg-primary inline-block" /> Normal
        </span>
        {showCritical && (
          <span className="flex items-center gap-1">
            <span className="w-4 h-1 rounded-full bg-destructive inline-block" /> Chemin critique
          </span>
        )}
        <span className="flex items-center gap-1">
          <Diamond className="w-3 h-3 text-primary" /> Milestone
        </span>
      </div>
    </div>
  );
}

// ── Helper: pixels per day ──
function getPixelsPerDay(zoom: ZoomLevel): number {
  switch (zoom) {
    case "day": return 30;
    case "week": return 60 / 7;
    case "month": return 120 / 30;
    case "quarter": return 200 / 90;
  }
}

// ── Generate columns ──
function generateColumns(start: Date, end: Date, zoom: ZoomLevel): { label: string; width: number }[] {
  const cols: { label: string; width: number }[] = [];
  switch (zoom) {
    case "day": {
      const days = eachDayOfInterval({ start, end });
      days.forEach((d) => cols.push({ label: format(d, "dd/MM", { locale: fr }), width: 30 }));
      break;
    }
    case "week": {
      const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      weeks.forEach((w) => cols.push({ label: `S${getWeek(w)}`, width: 60 }));
      break;
    }
    case "month": {
      const months = eachMonthOfInterval({ start, end });
      months.forEach((m) => cols.push({ label: format(m, "MMM yyyy", { locale: fr }), width: 120 }));
      break;
    }
    case "quarter": {
      let d = startOfQuarter(start);
      while (d <= end) {
        const q = Math.ceil((d.getMonth() + 1) / 3);
        cols.push({ label: `T${q} ${d.getFullYear()}`, width: 200 });
        d = addQuarters(d, 1);
      }
      break;
    }
  }
  return cols;
}

// ── Gantt Bar ──
function GanttBar({
  task,
  rowIndex,
  rangeStart,
  zoom,
  isCritical,
  totalFloat,
  onDoubleClick,
}: {
  task: FlatTask;
  rowIndex: number;
  rangeStart: Date;
  zoom: ZoomLevel;
  isCritical: boolean;
  totalFloat?: number;
  onDoubleClick: () => void;
}) {
  if (!task.startDate) return null;

  const start = new Date(task.startDate);
  const end = task.dueDate ? new Date(task.dueDate) : addDays(start, (task.durationDays || 1));
  const ppd = getPixelsPerDay(zoom);
  const left = differenceInDays(start, rangeStart) * ppd;
  const duration = Math.max(differenceInDays(end, start), 1);
  const width = duration * ppd;
  const progress = task.progress ?? 0;
  const top = 12 + rowIndex * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2;

  if (task.isMilestone) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute cursor-pointer z-[2]"
            style={{ left: left - 8, top: top + 4, width: 16, height: 16 }}
            onDoubleClick={onDoubleClick}
          >
            <Diamond className={`w-4 h-4 ${isCritical ? "text-destructive" : "text-primary"} fill-current`} />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <div className="font-medium">{task.title}</div>
            <div>{format(start, "dd/MM/yyyy")}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  const barColor = task.color || (task.hasChildren ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`absolute rounded z-[2] cursor-pointer transition-shadow hover:shadow-md group/bar ${
            isCritical ? "ring-2 ring-destructive" : ""
          } ${task.hasChildren ? "h-3" : "h-6"}`}
          style={{
            left,
            top: task.hasChildren ? top + 6 : top,
            width: Math.max(width, 4),
            backgroundColor: `color-mix(in srgb, ${barColor} 30%, transparent)`,
          }}
          onDoubleClick={onDoubleClick}
        >
          {/* Progress fill */}
          <div
            className="h-full rounded-l"
            style={{
              width: `${progress}%`,
              backgroundColor: barColor,
              borderRadius: progress >= 100 ? "4px" : "4px 0 0 4px",
            }}
          />
          {/* Label */}
          {width > 60 && (
            <span
              className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate pointer-events-none"
              style={{ color: progress > 50 ? "white" : "hsl(var(--foreground))" }}
            >
              {task.title} {progress > 0 && `${progress}%`}
            </span>
          )}
          {/* Parent task end markers */}
          {task.hasChildren && (
            <>
              <div className="absolute left-0 -bottom-1 w-1.5 h-1.5 bg-muted-foreground rounded-sm" />
              <div className="absolute right-0 -bottom-1 w-1.5 h-1.5 bg-muted-foreground rounded-sm" />
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="text-xs space-y-0.5">
          <div className="font-medium">{task.title}</div>
          <div>{format(start, "dd/MM/yyyy")} → {format(end, "dd/MM/yyyy")}</div>
          <div>Durée : {duration} jour(s)</div>
          <div>Progression : {progress}%</div>
          {totalFloat !== undefined && (
            <div className={totalFloat === 0 ? "text-destructive font-medium" : ""}>
              Marge : {totalFloat} jour(s) {totalFloat === 0 && "⚠️ Chemin critique"}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ── Today Line ──
function TodayLine({ today, rangeStart, zoom, rowCount }: { today: Date; rangeStart: Date; zoom: ZoomLevel; rowCount: number }) {
  const ppd = getPixelsPerDay(zoom);
  const left = differenceInDays(today, rangeStart) * ppd;
  return (
    <div
      className="absolute top-0 w-0.5 bg-destructive/70 z-[5] pointer-events-none"
      style={{ left, height: 12 + rowCount * ROW_HEIGHT }}
    />
  );
}

// ── Weekend Overlay ──
function WeekendOverlay({ rangeStart, rangeEnd, zoom, rowCount }: { rangeStart: Date; rangeEnd: Date; zoom: ZoomLevel; rowCount: number }) {
  const ppd = getPixelsPerDay(zoom);
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
  const weekendDays = days.filter((d) => isWeekend(d));
  const height = 12 + rowCount * ROW_HEIGHT;

  return (
    <>
      {weekendDays.map((d, i) => {
        const left = differenceInDays(d, rangeStart) * ppd;
        const holiday = isHoliday(d);
        return (
          <div
            key={i}
            className={`absolute top-0 pointer-events-none ${holiday ? "bg-muted/30" : "bg-muted/15"}`}
            style={{ left, width: ppd, height }}
          />
        );
      })}
    </>
  );
}

// ── Dependency Arrows (SVG) ──
function DependencyArrows({
  dependencies,
  flatTasks,
  rangeStart,
  zoom,
  criticalTaskIds,
}: {
  dependencies: TaskDependency[];
  flatTasks: FlatTask[];
  rangeStart: Date;
  zoom: ZoomLevel;
  criticalTaskIds: string[];
}) {
  const ppd = getPixelsPerDay(zoom);
  const taskIndexMap = new Map(flatTasks.map((t, i) => [t.id, i]));

  const arrows = dependencies
    .map((dep) => {
      const fromIdx = taskIndexMap.get(dep.dependsOnId);
      const toIdx = taskIndexMap.get(dep.taskId);
      if (fromIdx === undefined || toIdx === undefined) return null;

      const fromTask = flatTasks[fromIdx];
      const toTask = flatTasks[toIdx];
      if (!fromTask.startDate || !toTask.startDate) return null;

      const fromStart = new Date(fromTask.startDate);
      const fromEnd = fromTask.dueDate ? new Date(fromTask.dueDate) : addDays(fromStart, fromTask.durationDays || 1);
      const toStart = new Date(toTask.startDate);

      const fromX = differenceInDays(dep.type === "SS" || dep.type === "SF" ? fromStart : fromEnd, rangeStart) * ppd;
      const toX = differenceInDays(dep.type === "FF" || dep.type === "SF" ? 
        (toTask.dueDate ? new Date(toTask.dueDate) : addDays(toStart, toTask.durationDays || 1)) : toStart, rangeStart) * ppd;
      const fromY = 12 + fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toY = 12 + toIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      const isCritical = criticalTaskIds.includes(dep.taskId) && criticalTaskIds.includes(dep.dependsOnId);

      return { fromX, fromY, toX, toY, type: dep.type, isCritical };
    })
    .filter(Boolean) as { fromX: number; fromY: number; toX: number; toY: number; type: string; isCritical: boolean }[];

  if (arrows.length === 0) return null;

  const maxX = Math.max(...arrows.map((a) => Math.max(a.fromX, a.toX))) + 50;
  const maxY = Math.max(...arrows.map((a) => Math.max(a.fromY, a.toY))) + 50;

  return (
    <svg className="absolute top-0 left-0 pointer-events-none z-[3]" width={maxX} height={maxY}>
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--muted-foreground))" />
        </marker>
        <marker id="arrowhead-critical" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--destructive))" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const midX = a.fromX + 10;
        const color = a.isCritical ? "hsl(var(--destructive))" : 
          a.type === "SS" ? "#4A7FA5" : a.type === "FF" ? "#5A9A6A" : "hsl(var(--muted-foreground))";
        const markerId = a.isCritical ? "arrowhead-critical" : "arrowhead";

        const path = `M ${a.fromX} ${a.fromY} H ${midX} V ${a.toY} H ${a.toX}`;

        return (
          <path
            key={i}
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            markerEnd={`url(#${markerId})`}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}
