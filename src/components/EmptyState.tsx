import React from 'react';
import { Plus, ClipboardList, Columns3, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  variant?: 'list' | 'kanban' | 'calendar' | 'generic';
  onAction?: () => void;
  message?: string;
  actionLabel?: string;
}

const VARIANTS = {
  list: {
    icon: ClipboardList,
    title: 'Aucune tâche dans cette liste',
    subtitle: 'Créez votre première tâche pour organiser votre travail.',
  },
  kanban: {
    icon: Columns3,
    title: 'Aucune tâche dans ce projet',
    subtitle: 'Ajoutez des tâches pour visualiser votre progression.',
  },
  calendar: {
    icon: Calendar,
    title: 'Aucune tâche planifiée',
    subtitle: 'Les tâches avec une date d\'échéance apparaîtront ici.',
  },
  generic: {
    icon: ClipboardList,
    title: 'Rien à afficher',
    subtitle: 'Il n\'y a aucun élément pour le moment.',
  },
};

export default function EmptyState({ variant = 'generic', onAction, message, actionLabel }: EmptyStateProps) {
  const config = VARIANTS[variant];
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground/50" />
      </div>
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
