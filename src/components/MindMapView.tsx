import React, { useMemo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/TaskBadges';
import {
  ChevronDown, ChevronRight, ZoomIn, ZoomOut, Maximize2,
  Plus, X, Check, Layers, Repeat, Minus as MinusIcon,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

/* ─── Status colors ─── */
const STATUS_COLORS: Record<string, string> = {
  todo: 'hsl(var(--muted-foreground))',
  in_progress: 'hsl(var(--primary))',
  in_review: 'hsl(38, 92%, 50%)',
  done: 'hsl(142, 71%, 45%)',
  blocked: 'hsl(0, 84%, 60%)',
};

/* ─── Tree types ─── */
interface TreeNode {
  task: Task;
  children: TreeNode[];
  progress: number;
  totalDescendants: number;
  doneDescendants: number;
  depth: number;
}

/* ─── Build tree ─── */
function buildTree(tasks: Task[]): { roots: TreeNode[]; maxDepth: number } {
  const childrenMap = new Map<string, Task[]>();
  tasks.forEach(t => {
    const pid = t.parentTaskId || '__root__';
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(t);
  });

  let maxDepth = 0;

  function build(task: Task, depth: number): TreeNode {
    if (depth > maxDepth) maxDepth = depth;
    const children = (childrenMap.get(task.id) || [])
      .sort((a, b) => a.order - b.order)
      .map(c => build(c, depth + 1));

    let total = 0, done = 0;
    children.forEach(c => {
      total += 1 + c.totalDescendants;
      done += (c.task.status === 'done' ? 1 : 0) + c.doneDescendants;
    });

    const progress = children.length > 0
      ? Math.round((done / total) * 100)
      : task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : task.status === 'in_review' ? 75 : 0;

    return { task, children, progress, totalDescendants: total, doneDescendants: done, depth };
  }

  const roots = (childrenMap.get('__root__') || [])
    .filter(t => !t.parentTaskId)
    .sort((a, b) => a.order - b.order)
    .map(t => build(t, 0));

  return { roots, maxDepth };
}

/* ─── Layout constants ─── */
const NODE_W = 260;
const NODE_MIN_H = 72;
const H_GAP = 80;
const V_GAP = 20;

/* ─── Position calculator ─── */
interface Positioned {
  node: TreeNode;
  x: number;
  y: number;
  children: Positioned[];
}

function layoutTree(nodes: TreeNode[], expandedIds: Set<string>, visibleDepth: number): { positioned: Positioned[]; width: number; height: number } {
  let currentY = 0;

  function measure(node: TreeNode, depth: number): Positioned {
    const x = depth * (NODE_W + H_GAP);
    const isExpanded = expandedIds.has(node.task.id);
    const showChildren = isExpanded && depth < visibleDepth && node.children.length > 0;

    if (!showChildren) {
      const y = currentY;
      currentY += NODE_H + V_GAP;
      return { node, x, y, children: [] };
    }

    const childPositions = node.children.map(c => measure(c, depth + 1));
    const firstChildY = childPositions[0].y;
    const lastChildY = childPositions[childPositions.length - 1].y;
    const y = Math.round((firstChildY + lastChildY) / 2);

    return { node, x, y, children: childPositions };
  }

  const positioned: Positioned[] = [];
  nodes.forEach(root => {
    positioned.push(measure(root, 0));
  });

  // Calculate bounds
  let maxX = 0, maxY = 0;
  function walk(p: Positioned) {
    if (p.x + NODE_W > maxX) maxX = p.x + NODE_W;
    if (p.y + NODE_H > maxY) maxY = p.y + NODE_H;
    p.children.forEach(walk);
  }
  positioned.forEach(walk);

  return { positioned, width: maxX + 60, height: maxY + 60 };
}

/* ─── SVG connector (bezier curve) ─── */
function Connector({ from, to }: { from: Positioned; to: Positioned }) {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const midX = (x1 + x2) / 2;

  const statusColor = STATUS_COLORS[to.node.task.status] || 'hsl(var(--border))';

  return (
    <path
      d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
      fill="none"
      stroke={statusColor}
      strokeWidth="2"
      strokeOpacity="0.35"
      className="transition-all duration-300"
    />
  );
}

/* ─── Collect all connectors recursively ─── */
function collectConnectors(items: Positioned[]): { from: Positioned; to: Positioned }[] {
  const result: { from: Positioned; to: Positioned }[] = [];
  function walk(p: Positioned) {
    p.children.forEach(child => {
      result.push({ from: p, to: child });
      walk(child);
    });
  }
  items.forEach(walk);
  return result;
}

/* ─── Main component ─── */
export default function MindMapView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, tasks: allTasks, getSubtasks } = useApp();
  const rootTasks = getFilteredTasks();
  const isMobile = useIsMobile();

  // Build full task list: filtered root tasks + all their descendants
  const tasksWithChildren = useMemo(() => {
    const rootIds = new Set(rootTasks.map(t => t.id));
    const result = [...rootTasks];
    const visited = new Set(rootIds);

    function collectChildren(parentId: string) {
      const children = allTasks.filter(t => t.parentTaskId === parentId);
      children.forEach(child => {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          result.push(child);
          collectChildren(child.id);
        }
      });
    }

    rootTasks.forEach(t => collectChildren(t.id));
    return result;
  }, [rootTasks, allTasks]);

  const { roots, maxDepth } = useMemo(() => buildTree(tasksWithChildren), [tasksWithChildren]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [visibleDepth, setVisibleDepth] = useState(1);
  const [zoom, setZoom] = useState(isMobile ? 0.7 : 0.85);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-expand roots on mount
  useEffect(() => {
    if (roots.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(roots.map(r => r.task.id)));
    }
  }, [roots]);

  // Layout
  const { positioned, width, height } = useMemo(
    () => layoutTree(roots, expandedIds, visibleDepth),
    [roots, expandedIds, visibleDepth]
  );
  const connectors = useMemo(() => collectConnectors(positioned), [positioned]);

  // Toggle single node
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Expand a specific depth level
  const expandToDepth = useCallback((depth: number) => {
    setVisibleDepth(depth);
    const ids = new Set<string>();
    function collect(nodes: TreeNode[], d: number) {
      nodes.forEach(n => {
        if (d < depth && n.children.length > 0) {
          ids.add(n.task.id);
          collect(n.children, d + 1);
        }
      });
    }
    collect(roots, 0);
    setExpandedIds(ids);
  }, [roots]);

  // Expand all
  const expandAll = useCallback(() => {
    const ids = new Set<string>();
    function collect(nodes: TreeNode[]) {
      nodes.forEach(n => {
        if (n.children.length > 0) { ids.add(n.task.id); collect(n.children); }
      });
    }
    collect(roots);
    setExpandedIds(ids);
    setVisibleDepth(maxDepth + 1);
  }, [roots, maxDepth]);

  // Collapse all
  const collapseAll = useCallback(() => {
    setExpandedIds(new Set(roots.map(r => r.task.id)));
    setVisibleDepth(1);
  }, [roots]);

  // Reset view
  const resetView = useCallback(() => {
    setZoom(isMobile ? 0.7 : 0.85);
    setPan({ x: 20, y: 20 });
  }, [isMobile]);

  // Add subtask
  const handleAddSubtask = useCallback((parentTask: Task, title: string) => {
    addTask({
      title,
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: parentTask.id,
      listId: parentTask.listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setExpandedIds(prev => new Set([...prev, parentTask.id]));
  }, [addTask]);

  // ─── Pan & Zoom handlers ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.2, z - e.deltaY * 0.001)));
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      setPan({
        x: panStart.current.panX + (e.touches[0].clientX - panStart.current.x),
        y: panStart.current.panY + (e.touches[0].clientY - panStart.current.y),
      });
    }
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      setZoom(z => Math.min(2, Math.max(0.2, z * (dist / lastTouchDist.current!))));
      lastTouchDist.current = dist;
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDist.current = null;
  }, []);

  if (rootTasks.length === 0) {
    return <EmptyState variant="generic" message="Aucune tâche à afficher" />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ─── Toolbar ─── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-card shrink-0 overflow-x-auto">
        {/* Zoom */}
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0" title="Zoom +">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground w-10 text-center shrink-0">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.2, z - 0.15))} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0" title="Zoom -">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        {/* Level-by-level controls */}
        <span className="text-xs text-muted-foreground shrink-0 mr-1">Niveau :</span>
        {Array.from({ length: Math.min(maxDepth + 1, 6) }, (_, i) => i + 1).map(level => (
          <button
            key={level}
            onClick={() => expandToDepth(level)}
            className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors shrink-0 ${
              visibleDepth === level
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
            title={`Afficher niveau ${level}`}
          >
            {level}
          </button>
        ))}

        <div className="w-px h-5 bg-border mx-1 shrink-0" />

        <button onClick={expandAll} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors whitespace-nowrap shrink-0">
          <Layers className="w-4 h-4 inline mr-1" />
          Tout
        </button>
        <button onClick={collapseAll} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors whitespace-nowrap shrink-0">
          <MinusIcon className="w-4 h-4 inline mr-1" />
          Replier
        </button>
        <button onClick={resetView} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0" title="Recentrer">
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* ─── Canvas ─── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: width,
            height: height,
            position: 'relative',
          }}
        >
          {/* SVG connectors layer */}
          <svg
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none"
            style={{ overflow: 'visible' }}
          >
            {connectors.map(({ from, to }, i) => (
              <Connector key={i} from={from} to={to} />
            ))}
          </svg>

          {/* Node cards layer */}
          {positioned.map(p => (
            <MindMapNodeGroup
              key={p.node.task.id}
              positioned={p}
              expandedIds={expandedIds}
              visibleDepth={visibleDepth}
              toggleExpand={toggleExpand}
              onSelectTask={setSelectedTaskId}
              onAddSubtask={handleAddSubtask}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Recursive node renderer ─── */
interface MindMapNodeGroupProps {
  positioned: Positioned;
  expandedIds: Set<string>;
  visibleDepth: number;
  toggleExpand: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddSubtask: (parentTask: Task, title: string) => void;
}

function MindMapNodeGroup({ positioned, expandedIds, visibleDepth, toggleExpand, onSelectTask, onAddSubtask }: MindMapNodeGroupProps) {
  return (
    <>
      <NodeCard
        positioned={positioned}
        expandedIds={expandedIds}
        visibleDepth={visibleDepth}
        toggleExpand={toggleExpand}
        onSelectTask={onSelectTask}
        onAddSubtask={onAddSubtask}
      />
      {positioned.children.map(child => (
        <MindMapNodeGroup
          key={child.node.task.id}
          positioned={child}
          expandedIds={expandedIds}
          visibleDepth={visibleDepth}
          toggleExpand={toggleExpand}
          onSelectTask={onSelectTask}
          onAddSubtask={onAddSubtask}
        />
      ))}
    </>
  );
}

/* ─── Individual node card ─── */
function NodeCard({ positioned, expandedIds, visibleDepth, toggleExpand, onSelectTask, onAddSubtask }: MindMapNodeGroupProps) {
  const { node, x, y } = positioned;
  const { task, children, progress, totalDescendants, doneDescendants, depth } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(task.id);
  const canExpand = hasChildren && depth < visibleDepth;
  const statusColor = STATUS_COLORS[task.status] || 'hsl(var(--primary))';

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) inputRef.current.focus();
  }, [isAdding]);

  const handleSubmit = () => {
    const t = newTitle.trim();
    if (t) { onAddSubtask(task, t); setNewTitle(''); setIsAdding(false); }
  };

  const isRoot = depth === 0;

  return (
    <div
      data-node
      className="absolute transition-all duration-300 ease-out"
      style={{
        left: x,
        top: y,
        width: NODE_W,
      }}
    >
      {/* Main card */}
      <div
        className={`
          relative group rounded-xl border bg-card cursor-pointer
          transition-all duration-200
          hover:shadow-lg hover:border-primary/40
          ${isRoot ? 'ring-1 ring-primary/20' : ''}
        `}
        style={{
          borderLeftWidth: '3px',
          borderLeftColor: statusColor,
          minHeight: NODE_H,
        }}
        onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
      >
        <div className="px-3 py-2.5 flex items-start gap-2">
          {/* Expand/collapse button */}
          {hasChildren ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
              className="p-0.5 rounded hover:bg-muted transition-colors shrink-0 mt-0.5"
            >
              {isExpanded && canExpand
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          ) : (
            <div className="w-4.5 shrink-0" />
          )}

          <div className="flex-1 min-w-0">
            {/* Title */}
            <p className={`text-sm font-medium text-foreground truncate leading-tight flex items-center gap-1 ${isRoot ? 'text-base font-bold' : ''}`}>
              {task.title}
              {task.recurrence && <Repeat className="w-3 h-3 text-primary shrink-0" />}
            </p>

            {/* Badges */}
            <div className="flex items-center gap-1.5 mt-1">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>

            {/* Progress bar for parents */}
            {hasChildren && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: statusColor }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {doneDescendants}/{totalDescendants}
                </span>
              </div>
            )}

            {/* Collapsed children count badge */}
            {hasChildren && (!isExpanded || !canExpand) && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
                className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                {children.length} sous-tâche{children.length > 1 ? 's' : ''}
              </button>
            )}
          </div>

          {/* Add subtask button */}
          <button
            onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all shrink-0"
            title="Ajouter une sous-tâche"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Inline add subtask */}
      {isAdding && (
        <div data-node className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
            }}
            placeholder="Sous-tâche..."
            className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={handleSubmit} className="p-1 rounded hover:bg-primary/10 transition-colors" disabled={!newTitle.trim()}>
            <Check className="w-3.5 h-3.5 text-primary" />
          </button>
          <button onClick={() => { setIsAdding(false); setNewTitle(''); }} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
