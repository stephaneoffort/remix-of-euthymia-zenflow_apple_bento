import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Priority, PRIORITY_LABELS } from '@/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type FilterType = 'status' | 'priority' | 'assignee' | 'tag';

export default function TaskFilterBar() {
  const { advancedFilters, setAdvancedFilters, teamMembers, tasks, allStatuses, getStatusLabel } = useApp();
  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);

  const allPriorities: Priority[] = ['urgent', 'high', 'normal', 'low'];
  const allTags = Array.from(new Set(tasks.flatMap(t => t.tags))).sort();

  const hasFilters =
    advancedFilters.statuses.length > 0 ||
    advancedFilters.priorities.length > 0 ||
    advancedFilters.assigneeIds.length > 0 ||
    advancedFilters.tags.length > 0;

  const toggleValue = (key: keyof typeof advancedFilters, value: string) => {
    const current = advancedFilters[key] as string[];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setAdvancedFilters({ ...advancedFilters, [key]: next });
  };

  const clearAll = () => {
    setAdvancedFilters({ statuses: [], priorities: [], assigneeIds: [], tags: [] });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterDropdown
        label="Avancement"
        open={openFilter === 'status'}
        onOpenChange={(o) => setOpenFilter(o ? 'status' : null)}
        options={allStatuses.map(s => ({ value: s, label: getStatusLabel(s) }))}
        selected={advancedFilters.statuses}
        selectedLabels={advancedFilters.statuses.map(s => getStatusLabel(s))}
        onToggle={(v) => toggleValue('statuses', v)}
        onClear={() => setAdvancedFilters({ ...advancedFilters, statuses: [] })}
      />

      <FilterDropdown
        label="Priorité"
        open={openFilter === 'priority'}
        onOpenChange={(o) => setOpenFilter(o ? 'priority' : null)}
        options={allPriorities.map(p => ({ value: p, label: PRIORITY_LABELS[p] }))}
        selected={advancedFilters.priorities}
        selectedLabels={advancedFilters.priorities.map(p => PRIORITY_LABELS[p as Priority])}
        onToggle={(v) => toggleValue('priorities', v)}
        onClear={() => setAdvancedFilters({ ...advancedFilters, priorities: [] })}
      />

      <FilterDropdown
        label="Responsable"
        open={openFilter === 'assignee'}
        onOpenChange={(o) => setOpenFilter(o ? 'assignee' : null)}
        options={teamMembers.map(m => ({ value: m.id, label: m.name }))}
        selected={advancedFilters.assigneeIds}
        selectedLabels={advancedFilters.assigneeIds.map(id => teamMembers.find(m => m.id === id)?.name || id)}
        onToggle={(v) => toggleValue('assigneeIds', v)}
        onClear={() => setAdvancedFilters({ ...advancedFilters, assigneeIds: [] })}
      />

      {allTags.length > 0 && (
        <FilterDropdown
          label="Tags"
          open={openFilter === 'tag'}
          onOpenChange={(o) => setOpenFilter(o ? 'tag' : null)}
          options={allTags.map(t => ({ value: t, label: t }))}
          selected={advancedFilters.tags}
          selectedLabels={advancedFilters.tags}
          onToggle={(v) => toggleValue('tags', v)}
          onClear={() => setAdvancedFilters({ ...advancedFilters, tags: [] })}
        />
      )}

      {hasFilters && (
        <button
          onClick={clearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          <X className="w-3 h-3" />
          Tout effacer
        </button>
      )}
    </div>
  );
}

interface FilterDropdownProps {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: { value: string; label: string }[];
  selected: string[];
  selectedLabels: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}

function FilterDropdown({ label, open, onOpenChange, options, selected, selectedLabels, onToggle, onClear }: FilterDropdownProps) {
  const count = selected.length;
  const hasSelection = count > 0;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors max-w-[280px] ${
            hasSelection
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
          }`}
        >
          <Filter className="w-3 h-3 shrink-0" />
          {hasSelection ? (
            <>
              <span className="shrink-0">{label} ·</span>
              <span className="truncate">{selectedLabels.join(', ')}</span>
            </>
          ) : (
            <span>{label}</span>
          )}
          {hasSelection ? (
            <span
              role="button"
              className="shrink-0 ml-0.5 hover:bg-primary/20 rounded-full p-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            >
              <X className="w-3 h-3" />
            </span>
          ) : (
            <ChevronDown className="w-3 h-3 shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="max-h-56 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                selected.includes(opt.value)
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                  selected.includes(opt.value)
                    ? 'bg-primary border-primary'
                    : 'border-border'
                }`}
              >
                {selected.includes(opt.value) && (
                  <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground px-2.5 py-2">Aucune option</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
