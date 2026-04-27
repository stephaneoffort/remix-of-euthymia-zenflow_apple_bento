import React, { useState } from 'react';
import { Filter, X, ChevronDown, Bookmark, Save, Trash2, Check } from 'lucide-react';
import { useApp, AdvancedFilters } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Priority, PRIORITY_LABELS } from '@/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SpaceIcon } from '@/components/SpaceIcon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

type FilterType = 'status' | 'priority' | 'assignee' | 'tag' | 'space';

interface FilterPreset {
  id: string;
  name: string;
  filters: AdvancedFilters;
  member_id: string;
  created_at: string;
}

export default function TaskFilterBar() {
  const { advancedFilters, setAdvancedFilters, teamMembers, tasks, allStatuses, getStatusLabel, spaces } = useApp();
  const { teamMemberId } = useAuth();
  const queryClient = useQueryClient();
  const [openFilter, setOpenFilter] = useState<FilterType | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const allPriorities: Priority[] = ['urgent', 'high', 'normal', 'low'];
  const allTags = Array.from(new Set(tasks.flatMap(t => t.tags))).sort();

  const visibleSpaces = spaces.filter(s => !s.isArchived);

  const hasFilters =
    advancedFilters.statuses.length > 0 ||
    advancedFilters.priorities.length > 0 ||
    advancedFilters.assigneeIds.length > 0 ||
    advancedFilters.tags.length > 0 ||
    (advancedFilters.spaceIds ?? []).length > 0;

  // Fetch presets
  const { data: presets = [] } = useQuery<FilterPreset[]>({
    queryKey: ['filter-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('filter_presets')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        filters: { spaceIds: [], ...(p.filters as AdvancedFilters) },
      }));
    },
  });

  // Save preset
  const savePresetMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('filter_presets').insert({
        name,
        filters: advancedFilters as any,
        member_id: teamMemberId || 'unknown',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast.success('Préset sauvegardé');
      setSavingName('');
      setShowSaveInput(false);
    },
    onError: () => toast.error('Erreur lors de la sauvegarde'),
  });

  // Delete preset
  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('filter_presets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['filter-presets'] });
      toast.success('Préset supprimé');
    },
  });

  const toggleValue = (key: keyof typeof advancedFilters, value: string) => {
    const current = advancedFilters[key] as string[];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setAdvancedFilters({ ...advancedFilters, [key]: next });
  };

  const clearAll = () => {
    setAdvancedFilters({ statuses: [], priorities: [], assigneeIds: [], tags: [], spaceIds: [] });
  };

  const applyPreset = (preset: FilterPreset) => {
    setAdvancedFilters(preset.filters);
    setPresetsOpen(false);
  };

  const handleSavePreset = () => {
    const name = savingName.trim();
    if (!name) return;
    savePresetMutation.mutate(name);
  };

  const isPresetActive = (preset: FilterPreset) => {
    const f = preset.filters;
    return (
      JSON.stringify(f.statuses?.sort()) === JSON.stringify([...advancedFilters.statuses].sort()) &&
      JSON.stringify(f.priorities?.sort()) === JSON.stringify([...advancedFilters.priorities].sort()) &&
      JSON.stringify(f.assigneeIds?.sort()) === JSON.stringify([...advancedFilters.assigneeIds].sort()) &&
      JSON.stringify(f.tags?.sort()) === JSON.stringify([...advancedFilters.tags].sort()) &&
      JSON.stringify((f.spaceIds ?? []).sort()) === JSON.stringify([...(advancedFilters.spaceIds ?? [])].sort())
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Presets button */}
      <Popover open={presetsOpen} onOpenChange={(o) => { setPresetsOpen(o); if (!o) setShowSaveInput(false); }}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              presets.some(p => isPresetActive(p))
                ? 'border-accent bg-accent/10 text-accent-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20'
            }`}
          >
            <Bookmark className="w-3 h-3 shrink-0" />
            <span>Présets</span>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <div className="max-h-64 overflow-y-auto">
            {presets.length === 0 && !showSaveInput && (
              <p className="text-xs text-muted-foreground px-2.5 py-2">Aucun préset sauvegardé</p>
            )}
            {presets.map(preset => (
              <div
                key={preset.id}
                className={`flex items-center gap-1 group rounded-md transition-colors ${
                  isPresetActive(preset) ? 'bg-primary/10' : 'hover:bg-muted'
                }`}
              >
                <button
                  onClick={() => applyPreset(preset)}
                  className="flex-1 text-left flex items-center gap-2 px-2.5 py-1.5 text-sm min-w-0"
                >
                  {isPresetActive(preset) && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  <span className="truncate">{preset.name}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePresetMutation.mutate(preset.id); }}
                  className="p-1 mr-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Save new preset */}
            {showSaveInput ? (
              <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border mt-1 pt-1">
                <input
                  autoFocus
                  value={savingName}
                  onChange={(e) => setSavingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePreset(); if (e.key === 'Escape') setShowSaveInput(false); }}
                  placeholder="Nom du préset…"
                  className="flex-1 text-xs bg-transparent border border-border rounded px-2 py-1 outline-none focus:border-primary min-w-0"
                />
                <button
                  onClick={handleSavePreset}
                  disabled={!savingName.trim() || savePresetMutation.isPending}
                  className="p-1 rounded text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                disabled={!hasFilters}
                className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-t border-border mt-1 pt-1"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Sauvegarder les filtres actifs</span>
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {visibleSpaces.length > 1 && (
        <SpaceFilterDropdown
          open={openFilter === 'space'}
          onOpenChange={(o) => setOpenFilter(o ? 'space' : null)}
          spaces={visibleSpaces}
          selected={advancedFilters.spaceIds ?? []}
          onToggle={(id) => {
            const cur = advancedFilters.spaceIds ?? [];
            setAdvancedFilters({
              ...advancedFilters,
              spaceIds: cur.includes(id) ? cur.filter(v => v !== id) : [...cur, id],
            });
          }}
          onClear={() => setAdvancedFilters({ ...advancedFilters, spaceIds: [] })}
        />
      )}

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

interface SpaceFilterDropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaces: { id: string; name: string; icon?: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

function SpaceFilterDropdown({ open, onOpenChange, spaces, selected, onToggle, onClear }: SpaceFilterDropdownProps) {
  const hasSelection = selected.length > 0;
  const selectedNames = selected.map(id => spaces.find(s => s.id === id)?.name ?? id);

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
              <span className="shrink-0">Espace ·</span>
              <span className="truncate">{selectedNames.join(', ')}</span>
            </>
          ) : (
            <span>Espace</span>
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
      <PopoverContent className="w-52 p-1" align="start">
        <div className="max-h-56 overflow-y-auto">
          {spaces.map(space => (
            <button
              key={space.id}
              onClick={() => onToggle(space.id)}
              className={`w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                selected.includes(space.id)
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selected.includes(space.id) ? 'bg-primary border-primary' : 'border-border'
                }`}
              >
                {selected.includes(space.id) && (
                  <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <SpaceIcon value={space.icon} size="xs" className="shrink-0" />
              <span className="truncate">{space.name}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
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
