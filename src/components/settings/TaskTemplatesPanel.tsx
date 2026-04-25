import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, X, Check, FileText, Layers, Eye, EyeOff } from 'lucide-react';
import { useTaskTemplates, TaskTemplate, TemplateSubtask } from '@/hooks/useTaskTemplates';
import { Priority, PRIORITY_LABELS } from '@/types';
import { toast } from 'sonner';

const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low'];

export default function TaskTemplatesPanel() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate } = useTaskTemplates();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Modèles de tâches
          </CardTitle>
          {!isCreating && (
            <Button size="sm" onClick={() => setIsCreating(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Nouveau modèle
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
          <EyeOff className="w-3.5 h-3.5" />
          Les modèles ne s'affichent jamais dans les vues. Ils sont activés via le bouton
          « Utiliser un modèle » lors de la création d'une tâche.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {isCreating && (
          <TemplateEditor
            onCancel={() => setIsCreating(false)}
            onSave={async (input) => {
              try {
                await createTemplate(input);
                toast.success('Modèle créé');
                setIsCreating(false);
              } catch (e: any) {
                toast.error(e?.message || 'Erreur lors de la création');
              }
            }}
          />
        )}

        {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}

        {!loading && templates.length === 0 && !isCreating && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
            Aucun modèle pour le moment.
          </div>
        )}

        {templates.map((t) =>
          editingId === t.id ? (
            <TemplateEditor
              key={t.id}
              initial={t}
              onCancel={() => setEditingId(null)}
              onSave={async (input) => {
                try {
                  await updateTemplate(t.id, input);
                  toast.success('Modèle mis à jour');
                  setEditingId(null);
                } catch (e: any) {
                  toast.error(e?.message || 'Erreur lors de la mise à jour');
                }
              }}
            />
          ) : (
            <TemplateRow
              key={t.id}
              template={t}
              onEdit={() => setEditingId(t.id)}
              onDelete={async () => {
                if (!confirm(`Supprimer le modèle « ${t.name} » ?`)) return;
                try {
                  await deleteTemplate(t.id);
                  toast.success('Modèle supprimé');
                } catch (e: any) {
                  toast.error(e?.message || 'Erreur lors de la suppression');
                }
              }}
            />
          ),
        )}
      </CardContent>
    </Card>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: TaskTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{template.name}</span>
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {PRIORITY_LABELS[template.priority]}
            </span>
            {template.due_offset_days !== null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                +{template.due_offset_days}j
              </span>
            )}
            {template.subtasks.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3" /> {template.subtasks.length}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Titre : {template.title}
          </p>
          {template.tags.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: TaskTemplate;
  onSave: (input: {
    name: string;
    title: string;
    description: string;
    priority: Priority;
    tags: string[];
    due_offset_days: number | null;
    subtasks: TemplateSubtask[];
  }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [title, setTitle] = useState(initial?.title || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [priority, setPriority] = useState<Priority>(initial?.priority || 'normal');
  const [tagsText, setTagsText] = useState((initial?.tags || []).join(', '));
  const [dueOffset, setDueOffset] = useState<string>(
    initial?.due_offset_days !== null && initial?.due_offset_days !== undefined
      ? String(initial.due_offset_days)
      : '',
  );
  const [subtasks, setSubtasks] = useState<TemplateSubtask[]>(initial?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');

  const handleSave = () => {
    if (!name.trim()) return toast.error('Le nom du modèle est requis');
    if (!title.trim()) return toast.error('Le titre de la tâche est requis');

    const tags = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const due = dueOffset.trim() === '' ? null : Number(dueOffset);
    if (due !== null && (Number.isNaN(due) || due < 0)) {
      return toast.error('Échéance invalide (en jours, ≥ 0)');
    }

    onSave({
      name: name.trim(),
      title: title.trim(),
      description,
      priority,
      tags,
      due_offset_days: due,
      subtasks,
    });
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { title: newSubtask.trim() }]);
    setNewSubtask('');
  };

  return (
    <div className="border border-primary/40 bg-primary/5 rounded-lg p-3 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Nom du modèle</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Onboarding client" className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Priorité</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Titre généré</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tâche créée" className="h-9" />
      </div>

      <div>
        <Label className="text-xs">Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tags (séparés par des virgules)</Label>
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="design, urgent" className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Échéance relative (jours)</Label>
          <Input
            type="number"
            min={0}
            value={dueOffset}
            onChange={(e) => setDueOffset(e.target.value)}
            placeholder="Ex: 3"
            className="h-9"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" /> Sous-tâches
        </Label>
        <div className="space-y-1.5 mt-1.5">
          {subtasks.map((st, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={st.title}
                onChange={(e) => {
                  const copy = [...subtasks];
                  copy[i] = { ...copy[i], title: e.target.value };
                  setSubtasks(copy);
                }}
                className="h-8 text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSubtask())}
              placeholder="Ajouter une sous-tâche…"
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={addSubtask} className="h-8">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Annuler
        </Button>
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4 mr-1" /> Enregistrer
        </Button>
      </div>
    </div>
  );
}
