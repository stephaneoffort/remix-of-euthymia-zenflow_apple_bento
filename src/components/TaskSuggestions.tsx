import React, { useState } from 'react';
import { Sparkles, Plus, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface Suggestion {
  title: string;
  priority: string;
  description?: string;
}

interface TaskSuggestionsProps {
  open: boolean;
  onClose: () => void;
}

export default function TaskSuggestions({ open, onClose }: TaskSuggestionsProps) {
  const { tasks, projects, selectedProjectId, lists, addTask } = useApp();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());

  const project = projects.find(p => p.id === selectedProjectId);
  const projectTasks = tasks.filter(t => {
    const list = lists.find(l => l.id === t.listId);
    return list && (selectedProjectId ? list.projectId === selectedProjectId : true);
  });

  const fetchSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);
    setAdded(new Set());
    try {
      const { data, error } = await supabase.functions.invoke('suggest-tasks', {
        body: {
          projectName: project?.name || 'Mon projet',
          tasks: projectTasks.map(t => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            tags: t.tags,
          })),
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setSuggestions(data?.suggestions || []);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération des suggestions");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (idx: number, suggestion: Suggestion) => {
    const defaultList = lists.find(l => {
      const proj = selectedProjectId || projects[0]?.id;
      return l.projectId === proj;
    });
    if (!defaultList) {
      toast.error("Aucune liste trouvée pour ajouter la tâche");
      return;
    }
    addTask({
      title: suggestion.title,
      description: suggestion.description || '',
      status: 'todo',
      priority: suggestion.priority as any,
      listId: defaultList.id,
      tags: [],
      dueDate: null,
      startDate: null,
      parentTaskId: null,
      timeEstimate: null,
      timeLogged: null,
    });
    setAdded(prev => new Set(prev).add(idx));
    toast.success(`Tâche "${suggestion.title}" ajoutée !`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Suggestions IA</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {suggestions.length === 0 && !loading && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                L'IA analysera vos tâches existantes et suggérera de nouvelles tâches pertinentes.
              </p>
              <button
                onClick={fetchSuggestions}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4" />
                Générer des suggestions
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center py-10 gap-3">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyse en cours…</p>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-3">
              {suggestions.map((s, i) => {
                const isAdded = added.has(i);
                const prioColors: Record<string, string> = {
                  urgent: 'bg-destructive/10 text-destructive',
                  high: 'bg-orange-500/10 text-orange-600',
                  normal: 'bg-blue-500/10 text-blue-600',
                  low: 'bg-muted text-muted-foreground',
                };
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border transition-colors ${
                      isAdded ? 'border-primary/30 bg-primary/5' : 'border-border bg-background hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground">{s.title}</p>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                        )}
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium uppercase ${prioColors[s.priority] || prioColors.normal}`}>
                          {s.priority}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAdd(i, s)}
                        disabled={isAdded}
                        className={`shrink-0 p-1.5 rounded-md transition-colors ${
                          isAdded
                            ? 'bg-primary/10 text-primary cursor-default'
                            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {isAdded ? <span className="text-xs">✓</span> : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={fetchSuggestions}
                disabled={loading}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Régénérer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
