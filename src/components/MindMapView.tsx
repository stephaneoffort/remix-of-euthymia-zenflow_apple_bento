import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { PriorityBadge, StatusBadge } from '@/components/TaskBadges';
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Maximize2, Plus, X, Check } from 'lucide-react';

const STATUS_PROGRESS_COLORS: Record<string, string> = {
  todo: 'hsl(var(--muted-foreground))',
  in_progress: 'hsl(var(--primary))',
  in_review: 'hsl(38, 92%, 50%)',
  done: 'hsl(142, 71%, 45%)',
  blocked: 'hsl(0, 84%, 60%)',
};

interface TreeNode {
  task: Task;
  children: TreeNode[];
  progress: number; // 0-100
  totalDescendants: number;
  doneDescendants: number;
}

function buildTree(tasks: Task[]): TreeNode[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const childrenMap = new Map<string, Task[]>();
  tasks.forEach(t => {
    const parentId = t.parentTaskId || '__root__';
    if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
    childrenMap.get(parentId)!.push(t);
  });

  function buildNode(task: Task): TreeNode {
    const children = (childrenMap.get(task.id) || [])
      .sort((a, b) => a.order - b.order)
      .map(buildNode);

    let totalDescendants = 0;
    let doneDescendants = 0;

    if (children.length > 0) {
      children.forEach(c => {
        totalDescendants += 1 + c.totalDescendants;
        doneDescendants += (c.task.status === 'done' ? 1 : 0) + c.doneDescendants;
      });
    }

    const progress = children.length > 0
      ? Math.round((doneDescendants / totalDescendants) * 100)
      : task.status === 'done' ? 100 : task.status === 'in_progress' ? 50 : task.status === 'in_review' ? 75 : 0;

    return { task, children, progress, totalDescendants, doneDescendants };
  }

  const roots = (childrenMap.get('__root__') || [])
    .filter(t => !t.parentTaskId)
    .sort((a, b) => a.order - b.order)
    .map(buildNode);

  return roots;
}

export default function MindMapView() {
  const { getFilteredTasks, setSelectedTaskId, addTask, tasks: allTasks } = useApp();
  const tasks = getFilteredTasks();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(tasks), [tasks]);

  // Auto-expand roots on first render
  useEffect(() => {
    if (expandedIds.size === 0 && tree.length > 0) {
      setExpandedIds(new Set(tree.map(n => n.task.id)));
    }
  }, [tree]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set<string>();
    function collect(nodes: TreeNode[]) {
      nodes.forEach(n => {
        if (n.children.length > 0) {
          allIds.add(n.task.id);
          collect(n.children);
        }
      });
    }
    collect(tree);
    setExpandedIds(allIds);
  }, [tree]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Only start panning if clicking on the background
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
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Aucune tâche à afficher
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card shrink-0">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Zoom in">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Zoom out">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button onClick={expandAll} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors">
          Tout déplier
        </button>
        <button onClick={() => setExpandedIds(new Set(tree.map(n => n.task.id)))} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded-md transition-colors">
          Replier
        </button>
        <button onClick={resetView} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Reset">
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="min-w-max p-8"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          <div className="flex flex-col gap-6">
            {tree.map(node => (
              <MindMapNode
                key={node.task.id}
                node={node}
                depth={0}
                expandedIds={expandedIds}
                toggleExpand={toggleExpand}
                onSelectTask={setSelectedTaskId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MindMapNodeProps {
  node: TreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onSelectTask: (id: string) => void;
}

function MindMapNode({ node, depth, expandedIds, toggleExpand, onSelectTask }: MindMapNodeProps) {
  const { task, children, progress } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(task.id);
  const progressColor = STATUS_PROGRESS_COLORS[task.status] || 'hsl(var(--primary))';

  // Connector colors based on depth
  const connectorColor = depth === 0 ? 'hsl(var(--primary))' : 'hsl(var(--border))';

  return (
    <div className="flex items-start gap-0">
      {/* Node card */}
      <div data-node className="flex flex-col items-start">
        <div
          className="relative group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
          style={{
            borderLeftWidth: '3px',
            borderLeftColor: progressColor,
            minWidth: depth === 0 ? '260px' : '220px',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectTask(task.id);
          }}
        >
          {/* Expand toggle */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(task.id);
              }}
              className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
            >
              {isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </button>
          )}
          {!hasChildren && <div className="w-4.5" />}

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate leading-tight">{task.title}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>

            {/* Progress bar for parents */}
            {hasChildren && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, backgroundColor: progressColor }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  {progress}%
                </span>
              </div>
            )}

            {hasChildren && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {node.doneDescendants}/{node.totalDescendants} sous-tâche{node.totalDescendants !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Children branch */}
      {hasChildren && isExpanded && (
        <div className="flex items-start ml-0">
          {/* Horizontal connector */}
          <div className="flex flex-col items-start justify-start pt-4">
            <div className="w-6 h-px" style={{ backgroundColor: connectorColor }} />
          </div>

          {/* Vertical line + children */}
          <div className="relative flex flex-col gap-2">
            {/* Vertical connector line */}
            {children.length > 1 && (
              <div
                className="absolute left-0 top-0 bottom-0 w-px"
                style={{ backgroundColor: 'hsl(var(--border))' }}
              />
            )}

            {children.map((child, i) => (
              <div key={child.task.id} className="flex items-start">
                {/* Branch connector */}
                <div className="flex items-center shrink-0">
                  <div className="w-4 h-px" style={{ backgroundColor: 'hsl(var(--border))' }} />
                </div>

                <MindMapNode
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onSelectTask={onSelectTask}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
