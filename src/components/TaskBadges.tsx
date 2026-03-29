import React from 'react';
import { Priority } from '@/types';
import { AlertCircle, ArrowUp, Minus, ArrowDown, Circle, Loader, Eye, CheckCircle, Ban, CalendarSync } from 'lucide-react';

export const PriorityBadge = React.forwardRef<HTMLSpanElement, { priority: Priority }>(({ priority }, ref) => {
  const config: Record<Priority, { label: string; className: string; icon: React.ReactNode }> = {
    urgent: { label: 'Urgente', className: 'bg-priority-urgent/15 text-priority-urgent', icon: <AlertCircle className="w-3 h-3" /> },
    high: { label: 'Haute', className: 'bg-priority-high/15 text-priority-high', icon: <ArrowUp className="w-3 h-3" /> },
    normal: { label: 'Normale', className: 'bg-priority-normal/15 text-priority-normal', icon: <Minus className="w-3 h-3" /> },
    low: { label: 'Basse', className: 'bg-priority-low/15 text-priority-low', icon: <ArrowDown className="w-3 h-3" /> },
  };
  const c = config[priority];
  return (
    <span ref={ref} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon}{c.label}
    </span>
  );
});
PriorityBadge.displayName = 'PriorityBadge';

export const StatusBadge = React.forwardRef<HTMLSpanElement, { status: string }>(({ status }, ref) => {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    todo: { label: 'À faire', className: 'bg-status-todo/15 text-status-todo', icon: <Circle className="w-3 h-3" /> },
    in_progress: { label: 'En cours', className: 'bg-status-progress/15 text-status-progress', icon: <Loader className="w-3 h-3" /> },
    in_review: { label: 'En revue', className: 'bg-status-review/15 text-status-review', icon: <Eye className="w-3 h-3" /> },
    done: { label: 'Terminé', className: 'bg-status-done/15 text-status-done', icon: <CheckCircle className="w-3 h-3" /> },
    blocked: { label: 'Bloqué', className: 'bg-status-blocked/15 text-status-blocked', icon: <Ban className="w-3 h-3" /> },
  };
  const c = config[status] || { label: status, className: 'bg-primary/15 text-primary', icon: <Circle className="w-3 h-3" /> };
  return (
    <span ref={ref} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {c.icon}{c.label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

const STATUS_CIRCLE_CLASSES: Record<string, string> = {
  todo: 'text-status-todo',
  in_progress: 'text-status-progress',
  in_review: 'text-status-review',
  done: 'text-status-done',
  blocked: 'text-status-blocked',
};

export function StatusCircle({ status, className = 'w-4 h-4' }: { status: string; className?: string }) {
  const colorClass = STATUS_CIRCLE_CLASSES[status] || 'text-muted-foreground';
  if (status === 'done') return <CheckCircle className={`${className} ${colorClass}`} />;
  if (status === 'blocked') return <Ban className={`${className} ${colorClass}`} />;
  if (status === 'in_progress') return <Loader className={`${className} ${colorClass}`} />;
  if (status === 'in_review') return <Eye className={`${className} ${colorClass}`} />;
  return <Circle className={`${className} ${colorClass}`} />;
}

export function AvatarGroup({ memberIds, getMemberById }: { memberIds: string[]; getMemberById: (id: string) => any }) {
  if (!memberIds.length) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex -space-x-1.5">
      {memberIds.map(id => {
        const m = getMemberById(id);
        if (!m) return null;
        return m.avatarUrl ? (
            <img
              key={id}
              src={m.avatarUrl}
              alt={m.name}
              title={m.name}
              className="w-6 h-6 rounded-full object-cover ring-2 ring-card"
            />
          ) : (
            <div
              key={id}
              title={m.name}
              className="w-6 h-6 rounded-full flex items-center justify-center text-label font-bold ring-2 ring-card"
              style={{ backgroundColor: m.avatarColor, color: 'white' }}
            >
              {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>
          );
      })}
    </div>
  );
}

export function SubtaskProgress({ total, done }: { total: number; done: number }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-flex w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <span
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'hsl(var(--success, 142 71% 45%))' : 'hsl(var(--primary))',
          }}
        />
      </span>
      <CheckCircle className="w-3 h-3" />
      {done}/{total}
    </span>
  );
}

export function ZenflowBadge({ googleEventId }: { googleEventId?: string | null }) {
  if (!googleEventId) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary" title="Synchronisé avec ZENFLOW">
      <CalendarSync className="w-3 h-3" />
      ZENFLOW
    </span>
  );
}
