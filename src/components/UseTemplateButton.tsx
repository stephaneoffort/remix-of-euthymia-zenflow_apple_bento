import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FileText, Layers, Sparkles } from 'lucide-react';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { instantiateTemplate } from '@/lib/taskTemplates';
import { PRIORITY_LABELS } from '@/types';

interface Props {
  listId: string;
  assigneeIds?: string[];
  onCreated?: () => void;
  variant?: 'button' | 'icon';
  className?: string;
}

export default function UseTemplateButton({
  listId,
  assigneeIds = [],
  onCreated,
  variant = 'button',
  className = '',
}: Props) {
  const { templates, loading } = useTaskTemplates();
  const [open, setOpen] = useState(false);

  const handlePick = async (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setOpen(false);
    await instantiateTemplate(tpl, listId, assigneeIds);
    onCreated?.();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            title="Utiliser un modèle"
            className={`p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ${className}`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`gap-1.5 text-xs ${className}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Modèle
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground px-2 pt-1 pb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Modèles de tâches
        </div>
        {loading && (
          <div className="text-xs text-muted-foreground px-2 py-3">Chargement…</div>
        )}
        {!loading && templates.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-3 text-center">
            Aucun modèle. Crée-en un dans Paramètres → Modèles.
          </div>
        )}
        <div className="max-h-72 overflow-auto space-y-1">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handlePick(t.id)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
                <span className="text-[10px] uppercase tracking-wider px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                <span className="truncate">{t.title}</span>
                {t.subtasks.length > 0 && (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <Layers className="w-3 h-3" /> {t.subtasks.length}
                  </span>
                )}
                {t.due_offset_days !== null && (
                  <span className="shrink-0 text-primary">+{t.due_offset_days}j</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
