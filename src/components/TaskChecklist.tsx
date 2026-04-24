import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, Plus, Trash2, GripVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  is_checked: boolean;
  sort_order: number;
  created_at: string;
}

interface TaskChecklistProps {
  taskId: string;
}

export default function TaskChecklist({ taskId }: TaskChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });
    if (!error && data) setItems(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [taskId]);

  const addItem = async () => {
    if (!newTitle.trim()) return;
    const sortOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0;
    const { error } = await supabase.from('checklist_items').insert({
      task_id: taskId,
      title: newTitle.trim(),
      sort_order: sortOrder,
    });
    if (!error) {
      setNewTitle('');
      setIsAdding(false);
      fetchItems();
    }
  };

  const toggleItem = async (item: ChecklistItem) => {
    const { error } = await supabase
      .from('checklist_items')
      .update({ is_checked: !item.is_checked })
      .eq('id', item.id);
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_checked: !i.is_checked } : i));
    }
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from('checklist_items').delete().eq('id', id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const checkedCount = items.filter(i => i.is_checked).length;
  const progress = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  return (
    <div>
      <label className="text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
        <CheckSquare className="w-3.5 h-3.5" /> Checklist
        {items.length > 0 && (
          <span data-numeric className="font-numeric tabular-nums text-foreground/60">({checkedCount}/{items.length})</span>
        )}
      </label>

      {items.length > 0 && (
        <div className="w-full bg-muted/50 rounded-full h-1.5 mb-2">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {loading ? (
        <p className="text-xs text-foreground/60">Chargement...</p>
      ) : (
        <div className="space-y-1">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-2 group px-1 py-1 rounded-md hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={item.is_checked}
                onCheckedChange={() => toggleItem(item)}
              />
              <span
                className={`flex-1 text-sm transition-colors ${
                  item.is_checked ? 'line-through text-foreground/50' : 'text-foreground'
                }`}
              >
                {item.title}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                className="p-0.5 opacity-60 group-hover:opacity-100 text-foreground/45 hover:text-destructive transition-all shrink-0"
                title="Supprimer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="flex items-center gap-2 mt-2">
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addItem();
              if (e.key === 'Escape') { setIsAdding(false); setNewTitle(''); }
            }}
            placeholder="Élément de la checklist..."
            className="flex-1 text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
          <button
            onClick={addItem}
            disabled={!newTitle.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            Ajouter
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewTitle(''); }}
            className="px-2 py-1.5 text-xs text-foreground/60 hover:text-foreground"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground mt-2 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter un élément
        </button>
      )}
    </div>
  );
}
