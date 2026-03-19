import React, { useState } from 'react';
import { Filter, X, ChevronDown } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Status, Priority, STATUS_LABELS, PRIORITY_LABELS } from '@/types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type FilterType = 'status' | 'priority' | 'assignee' | 'tag';

interface FilterChipProps {
  label: string;
  values: string[];
  displayValues: string[];
  onRemove: (value: string) => void;
  onClear: () => void;
}

function FilterChip({ label, values, displayValues, onRemove, onClear }: FilterChipProps) {
  if (values.length === 0) return null;
  return (
    <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
      <span>{label}:</span>
      <span className="max-w-[150px] truncate">{displayValues.join(', ')}</span>
      <button onClick={onClear} className="ml-0.5 hover:text-primary/70 transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function TaskFilterBar() {
  const { advancedFilters, setAdvancedFilters, teamMembers, tasks } = useApp();
  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);

  const allStatuses: Status[] = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];
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
      {/* Filter buttons */}
      <FilterDropdown
        label="Avancement"
        open={openFilter === 'status'}
        onOpenChange={(o) => setOpenFilter(o ? 'status' : null)}
        options={allStatuses.map(s => ({ value: s, label: STATUS_LABELS[s] }))}
        selected={advancedFilters.statuses}
        onToggle={(v) => toggleValue('statuses', v)}
      />

      <FilterDropdown
        label="Priorité"
        open={openFilter === 'priority'}
        onOpenChange={(o) => setOpenFilter(o ? 'priority' : null)}
        options={allPriorities.map(p => ({ value: p, label: PRIORITY_LABELS[p] }))}
        selected={advancedFilters.priorities}
        onToggle={(v) => toggleValue('priorities', v)}
      />

      <FilterDropdown
        label="Responsable"
        open={openFilter === 'assignee'}
        onOpenChange={(o) => setOpenFilter(o ? 'assignee' : null)}
        options={teamMembers.map(m => ({ value: m.id, label: m.name }))}
        selected={advancedFilters.assigneeIds}
        onToggle={(v) => toggleValue('assigneeIds', v)}
      />

      {allTags.length > 0 && (
        <FilterDropdown
          label="Tags"
          open={openFilter === 'tag'}
          onOpenChange={(o) => setOpenFilter(o ? 'tag' : null)}
          options={allTags.map(t => ({ value: t, label: t }))}
          selected={advancedFilters.tags}
          onToggle={(v) => toggleValue('tags', v)}
        />
      )}

      {/* Active filter chips */}
      {advancedFilters.statuses.length > 0 && (
        <FilterChip
          label="Avancement"
          values={advancedFilters.statuses}
          displayValues={advancedFilters.statuses.map(s => STATUS_LABELS[s as Status])}
          onRemove={(v) => toggleValue('statuses', v)}
          onClear={() => setAdvancedFilters({ ...advancedFilters, statuses: [] })}
        />
      )}
      {advancedFilters.priorities.length > 0 && (
        <FilterChip
          label="Priorité"
          values={advancedFilters.priorities}
          displayValues={advancedFilters.priorities.map(p => PRIORITY_LABELS[p as Priority])}
          onRemove={(v) => toggleValue('priorities', v)}
          onClear={() => setAdvancedFilters({ ...advancedFilters, priorities: [] })}
        />
      )}
      {advancedFilters.assigneeIds.length > 0 && (
        <FilterChip
          label="Responsable"
          values={advancedFilters.assigneeIds}
          displayValues={advancedFilters.assigneeIds.map(id => teamMembers.find(m => m.id === id)?.name || id)}
          onRemove={(v) => toggleValue('assigneeIds', v)}
          onClear={() => setAdvancedFilters({ ...advancedFilters, assigneeIds: [] })}
        />
      )}
      {advancedFilters.tags.length > 0 && (
        <FilterChip
          label="Tags"
          values={advancedFilters.tags}
          displayValues={advancedFilters.tags}
          onRemove={(v) => toggleValue('tags', v)}
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
  onToggle: (value: string) => void;
}

function FilterDropdown({ label, open, onOpenChange, options, selected, onToggle }: FilterDropdownProps) {
  const count = selected.length;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            count > 0
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
          }`}
        >
          <Filter className="w-3 h-3" />
          {label}
          {count > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
              {count}
            </span>
          )}
          <ChevronDown className="w-3 h-3" />
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
