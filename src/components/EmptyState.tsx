import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  variant?: 'list' | 'kanban' | 'calendar' | 'generic';
  onAction?: () => void;
  message?: string;
  actionLabel?: string;
}

function ListIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
      {/* Clipboard body */}
      <rect x="30" y="16" width="60" height="76" rx="6" className="fill-muted/50 stroke-muted-foreground/20" strokeWidth="1.5" />
      {/* Clipboard clip */}
      <rect x="46" y="10" width="28" height="12" rx="4" className="fill-background stroke-muted-foreground/25" strokeWidth="1.5" />
      <circle cx="60" cy="16" r="2.5" className="fill-muted-foreground/20" />
      {/* Lines */}
      <rect x="42" y="34" width="36" height="4" rx="2" className="fill-primary/20" />
      <rect x="42" y="44" width="28" height="4" rx="2" className="fill-muted-foreground/15" />
      <rect x="42" y="54" width="32" height="4" rx="2" className="fill-muted-foreground/15" />
      <rect x="42" y="64" width="24" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="42" y="74" width="20" height="4" rx="2" className="fill-muted-foreground/10" />
      {/* Decorative dot */}
      <circle cx="96" cy="28" r="5" className="fill-primary/15" />
      <circle cx="24" cy="80" r="3" className="fill-accent/40" />
    </svg>
  );
}

function KanbanIllustration() {
  return (
    <svg width="140" height="100" viewBox="0 0 140 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
      {/* Column 1 */}
      <rect x="12" y="18" width="34" height="70" rx="5" className="fill-muted/40 stroke-muted-foreground/15" strokeWidth="1" />
      <rect x="17" y="24" width="24" height="4" rx="2" className="fill-primary/25" />
      <rect x="17" y="34" width="24" height="16" rx="3" className="fill-background stroke-muted-foreground/15" strokeWidth="1" />
      <rect x="17" y="55" width="24" height="12" rx="3" className="fill-background stroke-muted-foreground/10" strokeWidth="1" />
      {/* Column 2 */}
      <rect x="53" y="18" width="34" height="70" rx="5" className="fill-muted/40 stroke-muted-foreground/15" strokeWidth="1" />
      <rect x="58" y="24" width="24" height="4" rx="2" className="fill-status-progress/30" />
      <rect x="58" y="34" width="24" height="20" rx="3" className="fill-background stroke-muted-foreground/15" strokeWidth="1" />
      {/* Column 3 */}
      <rect x="94" y="18" width="34" height="70" rx="5" className="fill-muted/40 stroke-muted-foreground/15" strokeWidth="1" />
      <rect x="99" y="24" width="24" height="4" rx="2" className="fill-status-done/30" />
      <rect x="99" y="34" width="24" height="14" rx="3" className="fill-background stroke-muted-foreground/10" strokeWidth="1" />
      <rect x="99" y="53" width="24" height="14" rx="3" className="fill-background stroke-muted-foreground/10" strokeWidth="1" />
      <rect x="99" y="72" width="24" height="10" rx="3" className="fill-background stroke-muted-foreground/8" strokeWidth="1" />
      {/* Decorative */}
      <circle cx="8" cy="30" r="3" className="fill-primary/12" />
      <circle cx="133" cy="78" r="4" className="fill-accent/30" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
      {/* Calendar body */}
      <rect x="22" y="20" width="76" height="68" rx="6" className="fill-muted/40 stroke-muted-foreground/20" strokeWidth="1.5" />
      {/* Header bar */}
      <rect x="22" y="20" width="76" height="16" rx="6" className="fill-primary/15" />
      <rect x="22" y="30" width="76" height="6" className="fill-primary/15" />
      {/* Calendar hooks */}
      <rect x="40" y="14" width="3" height="12" rx="1.5" className="fill-muted-foreground/25" />
      <rect x="77" y="14" width="3" height="12" rx="1.5" className="fill-muted-foreground/25" />
      {/* Grid dots — 4x3 */}
      {[0, 1, 2, 3].map(col =>
        [0, 1, 2].map(row => (
          <rect
            key={`${col}-${row}`}
            x={32 + col * 16}
            y={44 + row * 14}
            width="10"
            height="8"
            rx="2"
            className={
              col === 2 && row === 1
                ? 'fill-primary/25 stroke-primary/30'
                : 'fill-muted-foreground/8'
            }
            strokeWidth={col === 2 && row === 1 ? '1' : '0'}
          />
        ))
      )}
      {/* Decorative */}
      <circle cx="104" cy="18" r="4" className="fill-accent/30" />
      <circle cx="16" cy="72" r="3" className="fill-primary/10" />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg width="100" height="90" viewBox="0 0 100 90" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-2">
      {/* Stacked papers */}
      <rect x="24" y="22" width="52" height="60" rx="5" className="fill-muted/30 stroke-muted-foreground/10" strokeWidth="1" />
      <rect x="20" y="18" width="52" height="60" rx="5" className="fill-muted/50 stroke-muted-foreground/15" strokeWidth="1" />
      <rect x="16" y="14" width="52" height="60" rx="5" className="fill-background stroke-muted-foreground/20" strokeWidth="1.5" />
      {/* Content lines */}
      <rect x="26" y="28" width="32" height="4" rx="2" className="fill-muted-foreground/15" />
      <rect x="26" y="38" width="24" height="3" rx="1.5" className="fill-muted-foreground/10" />
      <rect x="26" y="46" width="28" height="3" rx="1.5" className="fill-muted-foreground/10" />
      {/* Magnifier */}
      <circle cx="72" cy="60" r="12" className="stroke-muted-foreground/20" strokeWidth="1.5" fill="none" />
      <line x1="80" y1="69" x2="88" y2="77" className="stroke-muted-foreground/20" strokeWidth="2" strokeLinecap="round" />
      {/* Decorative */}
      <circle cx="82" cy="20" r="4" className="fill-primary/12" />
    </svg>
  );
}

const VARIANTS = {
  list: {
    illustration: ListIllustration,
    title: 'Aucune tâche dans cette liste',
    subtitle: 'Créez votre première tâche pour organiser votre travail.',
  },
  kanban: {
    illustration: KanbanIllustration,
    title: 'Aucune tâche dans ce projet',
    subtitle: 'Ajoutez des tâches pour visualiser votre progression.',
  },
  calendar: {
    illustration: CalendarIllustration,
    title: 'Aucune tâche planifiée',
    subtitle: 'Les tâches avec une date d\'échéance apparaîtront ici.',
  },
  generic: {
    illustration: GenericIllustration,
    title: 'Rien à afficher',
    subtitle: 'Il n\'y a aucun élément pour le moment.',
  },
};

export default function EmptyState({ variant = 'generic', onAction, message, actionLabel }: EmptyStateProps) {
  const config = VARIANTS[variant];
  const Illustration = config.illustration;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Illustration />
      <p className="text-sm font-medium text-foreground mb-1">
        {message || config.title}
      </p>
      <p className="text-xs text-muted-foreground max-w-[240px]">
        {config.subtitle}
      </p>
      {onAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          className="mt-4 gap-1.5"
        >
          <Plus className="w-4 h-4" />
          {actionLabel || 'Créer une tâche'}
        </Button>
      )}
    </div>
  );
}
