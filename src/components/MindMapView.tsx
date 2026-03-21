import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import EmptyState from '@/components/EmptyState';
import { useApp } from '@/context/AppContext';
import { Task } from '@/types';
import { PriorityBadge, StatusBadge } from '@/components/TaskBadges';
import { ChevronDown, ChevronRight, ZoomIn, ZoomOut, Maximize2, Plus, X, Check, Layers, Repeat } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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
  progress: number;
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
  const isMobile = useIsMobile();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(isMobile ? 0.85 : 1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const tree = useMemo(() => buildTree(tasks), [tasks]);

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
    setZoom(isMobile ? 0.85 : 1);
    setPan({ x: 0, y: 0 });
  }, [isMobile]);

  // Mouse pan handlers
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
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  // Touch pan & pinch-zoom handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: pan.x, panY: pan.y };
    }
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      setPan({
        x: panStart.current.panX + (e.touches[0].clientX - panStart.current.x),
        y: panStart.current.panY + (e.touches[0].clientY - panStart.current.y),
      });
    }
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / lastTouchDistance.current;
      setZoom(z => Math.min(2, Math.max(0.3, z * scale)));
      lastTouchDistance.current = dist;
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    lastTouchDistance.current = null;
  }, []);

  if (tasks.length === 0) {
    return <EmptyState variant="generic" message="Aucune tâche à afficher" />;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0 overflow-x-auto">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="p-1.5 rounded-md hover:bg-muted active:bg-muted transition-colors shrink-0" title="Zoom in">
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="text-xs text-muted-foreground w-10 text-center shrink-0">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="p-1.5 rounded-md hover:bg-muted active:bg-muted transition-colors shrink-0" title="Zoom out">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="w-px h-5 bg-border mx-0.5 shrink-0" />
        <button onClick={expandAll} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted active:bg-muted rounded-md transition-colors whitespace-nowrap shrink-0">
          {isMobile ? <Layers className="w-4 h-4" /> : 'Tout déplier'}
        </button>
        <button onClick={() => setExpandedIds(new Set(tree.map(n => n.task.id)))} className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted active:bg-muted rounded-md transition-colors whitespace-nowrap shrink-0">
          {isMobile ? 'Replier' : 'Replier'}
        </button>
        <button onClick={resetView} className="p-1.5 rounded-md hover:bg-muted active:bg-muted transition-colors shrink-0" title="Reset">
          <Maximize2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Canvas */}
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
          className="min-w-max p-4 sm:p-8"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {isMobile ? (
            // Mobile: vertical tree layout
            <div className="flex flex-col gap-3">
              {tree.map(node => (
                <MobileTreeNode
                  key={node.task.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onSelectTask={setSelectedTaskId}
                  onAddSubtask={(parentTask, title) => {
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
                  }}
                />
              ))}
            </div>
          ) : (
            // Desktop: horizontal tree layout
            <div className="flex flex-col gap-6">
              {tree.map(node => (
                <MindMapNode
                  key={node.task.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onSelectTask={setSelectedTaskId}
                  onAddSubtask={(parentTask, title) => {
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
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Mobile vertical tree node
// ============================================================
interface MobileTreeNodeProps {
  node: TreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddSubtask: (parentTask: Task, title: string) => void;
}

function MobileTreeNode({ node, depth, expandedIds, toggleExpand, onSelectTask, onAddSubtask }: MobileTreeNodeProps) {
  const { task, children, progress } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(task.id);
  const progressColor = STATUS_PROGRESS_COLORS[task.status] || 'hsl(var(--primary))';
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const handleSubmit = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddSubtask(task, trimmed);
      setNewTitle('');
      setIsAdding(false);
    }
  };

  return (
    <div data-node style={{ paddingLeft: `${depth * 16}px` }}>
      {/* Node card */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-card active:bg-muted/50 transition-colors"
        style={{ borderLeftWidth: '3px', borderLeftColor: progressColor }}
        onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
            className="p-1 rounded active:bg-muted transition-colors shrink-0"
          >
            {isExpanded
              ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
              : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            }
          </button>
        )}
        {!hasChildren && <div className="w-6" />}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight truncate flex items-center gap-1">{task.title}{task.recurrence && <Repeat className="w-3 h-3 text-primary shrink-0" />}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {hasChildren && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {node.doneDescendants}/{node.totalDescendants}
              </span>
            )}
          </div>
          {hasChildren && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, backgroundColor: progressColor }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{progress}%</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
          className="p-1.5 rounded active:bg-muted transition-colors shrink-0"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Inline add */}
      {isAdding && (
        <div data-node className="flex items-center gap-1.5 mt-1.5 ml-8" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
            }}
            placeholder="Sous-tâche..."
            className="flex-1 px-2.5 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button onClick={handleSubmit} className="p-1.5 rounded active:bg-primary/10 transition-colors" disabled={!newTitle.trim()}>
            <Check className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => { setIsAdding(false); setNewTitle(''); }} className="p-1.5 rounded active:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-1.5 space-y-1.5 relative">
          <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" style={{ marginLeft: `${depth * 16}px` }} />
          {children.map(child => (
            <MobileTreeNode
              key={child.task.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onSelectTask={onSelectTask}
              onAddSubtask={onAddSubtask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Desktop horizontal tree node (unchanged)
// ============================================================
interface MindMapNodeProps {
  node: TreeNode;
  depth: number;
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
  onSelectTask: (id: string) => void;
  onAddSubtask: (parentTask: Task, title: string) => void;
}

function MindMapNode({ node, depth, expandedIds, toggleExpand, onSelectTask, onAddSubtask }: MindMapNodeProps) {
  const { task, children, progress } = node;
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(task.id);
  const progressColor = STATUS_PROGRESS_COLORS[task.status] || 'hsl(var(--primary))';
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSubmit = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddSubtask(task, trimmed);
      setNewTitle('');
      setIsAdding(false);
    }
  };

  const connectorColor = depth === 0 ? 'hsl(var(--primary))' : 'hsl(var(--border))';

  return (
    <div className="flex items-start gap-0">
      <div data-node className="flex flex-col items-start gap-1">
        <div
          className="relative group flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
          style={{
            borderLeftWidth: '3px',
            borderLeftColor: progressColor,
            minWidth: depth === 0 ? '260px' : '220px',
          }}
          onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
        >
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
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
            <p className="text-sm font-medium text-foreground truncate leading-tight flex items-center gap-1">{task.title}{task.recurrence && <Repeat className="w-3 h-3 text-primary shrink-0" />}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            {hasChildren && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: progressColor }} />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">{progress}%</span>
              </div>
            )}
            {hasChildren && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {node.doneDescendants}/{node.totalDescendants} sous-tâche{node.totalDescendants !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setIsAdding(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted transition-all shrink-0"
            title="Ajouter une sous-tâche"
          >
            <Plus className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {isAdding && (
          <div data-node className="flex items-center gap-1.5 ml-6" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
              }}
              placeholder="Nom de la sous-tâche..."
              className="px-2 py-1.5 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
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

      {hasChildren && isExpanded && (
        <div className="flex items-start ml-0">
          <div className="flex flex-col items-start justify-start pt-4">
            <div className="w-6 h-px" style={{ backgroundColor: connectorColor }} />
          </div>
          <div className="relative flex flex-col gap-2">
            {children.length > 1 && (
              <div className="absolute left-0 top-0 bottom-0 w-px" style={{ backgroundColor: 'hsl(var(--border))' }} />
            )}
            {children.map((child) => (
              <div key={child.task.id} className="flex items-start">
                <div className="flex items-center shrink-0">
                  <div className="w-4 h-px" style={{ backgroundColor: 'hsl(var(--border))' }} />
                </div>
                <MindMapNode
                  node={child}
                  depth={depth + 1}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                  onSelectTask={onSelectTask}
                  onAddSubtask={onAddSubtask}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
