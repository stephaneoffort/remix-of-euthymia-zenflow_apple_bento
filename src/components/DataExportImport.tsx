import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download, Upload, Loader2, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import CsvTaskImport from '@/components/CsvTaskImport';

interface ExportData {
  version: string;
  exportedAt: string;
  team_members: any[];
  spaces: any[];
  space_members: any[];
  space_managers: any[];
  projects: any[];
  task_lists: any[];
  tasks: any[];
  task_assignees: any[];
  checklist_items: any[];
  comments: any[];
  attachments: any[];
  custom_statuses: any[];
  chat_channels: any[];
  chat_channel_members: any[];
  chat_messages: any[];
  chat_reactions: any[];
}

export default function DataExportImport() {
  const [exporting, setExporting] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ExportData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const [
        { data: team_members },
        { data: spaces },
        { data: space_members },
        { data: space_managers },
        { data: projects },
        { data: task_lists },
        { data: tasks },
        { data: task_assignees },
        { data: checklist_items },
        { data: comments },
        { data: attachments },
        { data: custom_statuses },
        { data: chat_channels },
        { data: chat_channel_members },
        { data: chat_messages },
        { data: chat_reactions },
      ] = await Promise.all([
        supabase.from('team_members').select('*'),
        supabase.from('spaces').select('*').order('sort_order'),
        supabase.from('space_members').select('*'),
        supabase.from('space_managers').select('*'),
        supabase.from('projects').select('*').order('sort_order'),
        supabase.from('task_lists').select('*').order('sort_order'),
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('task_assignees').select('*'),
        supabase.from('checklist_items').select('*').order('sort_order'),
        supabase.from('comments').select('*').order('created_at'),
        supabase.from('attachments').select('*'),
        supabase.from('custom_statuses').select('*').order('sort_order'),
        supabase.from('chat_channels').select('*').order('position'),
        supabase.from('chat_channel_members').select('*'),
        supabase.from('chat_messages').select('*').order('created_at'),
        supabase.from('chat_reactions').select('*'),
      ]);

      const exportData: ExportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        team_members: team_members || [],
        spaces: spaces || [],
        space_members: space_members || [],
        space_managers: space_managers || [],
        projects: projects || [],
        task_lists: task_lists || [],
        tasks: tasks || [],
        task_assignees: task_assignees || [],
        checklist_items: checklist_items || [],
        comments: comments || [],
        attachments: attachments || [],
        custom_statuses: custom_statuses || [],
        chat_categories: chat_categories || [],
        chat_messages: chat_messages || [],
        chat_reactions: chat_reactions || [],
        direct_conversations: direct_conversations || [],
        direct_conversation_members: direct_conversation_members || [],
        direct_messages: direct_messages || [],
        dm_reactions: dm_reactions || [],
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `euthymia-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export terminé');
    } catch (err) {
      toast.error('Erreur lors de l\'export');
      console.error(err);
    }
    setExporting(false);
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const [
        { data: tasks },
        { data: task_assignees },
        { data: task_lists },
        { data: projects },
        { data: spaces },
        { data: team_members },
      ] = await Promise.all([
        supabase.from('tasks').select('*').order('sort_order'),
        supabase.from('task_assignees').select('*'),
        supabase.from('task_lists').select('*'),
        supabase.from('projects').select('*'),
        supabase.from('spaces').select('*'),
        supabase.from('team_members').select('*'),
      ]);

      const listMap = Object.fromEntries((task_lists || []).map(l => [l.id, l]));
      const projMap = Object.fromEntries((projects || []).map(p => [p.id, p]));
      const spaceMap = Object.fromEntries((spaces || []).map(s => [s.id, s]));
      const memberMap = Object.fromEntries((team_members || []).map(m => [m.id, m.name]));

      const assigneesByTask: Record<string, string[]> = {};
      (task_assignees || []).forEach(a => {
        if (!assigneesByTask[a.task_id]) assigneesByTask[a.task_id] = [];
        assigneesByTask[a.task_id].push(memberMap[a.member_id] || a.member_id);
      });

      const csvEscape = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return '"' + val.replace(/"/g, '""') + '"';
        }
        return val;
      };

      const headers = ['title', 'description', 'status', 'priority', 'due_date', 'start_date', 'tags', 'assignees', 'time_estimate', 'time_logged', 'recurrence', 'list', 'project', 'space', 'created_at'];
      const rows = (tasks || []).map(t => {
        const list = listMap[t.list_id];
        const proj = list ? projMap[list.project_id] : null;
        const space = proj ? spaceMap[proj.space_id] : null;
        return [
          t.title,
          t.description || '',
          t.status,
          t.priority,
          t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : '',
          t.start_date ? new Date(t.start_date).toISOString().slice(0, 10) : '',
          (t.tags || []).join(', '),
          (assigneesByTask[t.id] || []).join(', '),
          t.time_estimate != null ? String(t.time_estimate) : '',
          t.time_logged != null ? String(t.time_logged) : '',
          t.recurrence || '',
          list?.name || '',
          proj?.name || '',
          space?.name || '',
          t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '',
        ].map(v => csvEscape(v));
      });

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `euthymia-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV terminé');
    } catch (err) {
      toast.error("Erreur lors de l'export CSV");
      console.error(err);
    }
    setExportingCsv(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportData;
        if (!data.version || !data.spaces || !data.tasks) {
          toast.error('Fichier invalide : format non reconnu');
          return;
        }
        setImportPreview(data);
      } catch {
        toast.error('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    try {
      const d = importPreview;

      // Order matters for foreign key constraints
      if (d.team_members.length) {
        const { error } = await supabase.from('team_members').upsert(d.team_members, { onConflict: 'id' });
        if (error) throw new Error(`team_members: ${error.message}`);
      }
      if (d.spaces.length) {
        const { error } = await supabase.from('spaces').upsert(d.spaces, { onConflict: 'id' });
        if (error) throw new Error(`spaces: ${error.message}`);
      }
      if (d.space_members.length) {
        // Delete existing then re-insert
        await supabase.from('space_members').delete().neq('space_id', '___none___');
        const { error } = await supabase.from('space_members').insert(d.space_members);
        if (error) throw new Error(`space_members: ${error.message}`);
      }
      if (d.space_managers.length) {
        await supabase.from('space_managers').delete().neq('space_id', '___none___');
        const { error } = await supabase.from('space_managers').insert(d.space_managers);
        if (error) throw new Error(`space_managers: ${error.message}`);
      }
      if (d.projects.length) {
        const { error } = await supabase.from('projects').upsert(d.projects, { onConflict: 'id' });
        if (error) throw new Error(`projects: ${error.message}`);
      }
      if (d.task_lists.length) {
        const { error } = await supabase.from('task_lists').upsert(d.task_lists, { onConflict: 'id' });
        if (error) throw new Error(`task_lists: ${error.message}`);
      }
      if (d.tasks.length) {
        const { error } = await supabase.from('tasks').upsert(d.tasks, { onConflict: 'id' });
        if (error) throw new Error(`tasks: ${error.message}`);
      }
      if (d.task_assignees.length) {
        await supabase.from('task_assignees').delete().neq('task_id', '___none___');
        const { error } = await supabase.from('task_assignees').insert(d.task_assignees);
        if (error) throw new Error(`task_assignees: ${error.message}`);
      }
      if (d.checklist_items.length) {
        const { error } = await supabase.from('checklist_items').upsert(d.checklist_items, { onConflict: 'id' });
        if (error) throw new Error(`checklist_items: ${error.message}`);
      }
      if (d.comments.length) {
        const { error } = await supabase.from('comments').upsert(d.comments, { onConflict: 'id' });
        if (error) throw new Error(`comments: ${error.message}`);
      }
      if (d.attachments.length) {
        const { error } = await supabase.from('attachments').upsert(d.attachments, { onConflict: 'id' });
        if (error) throw new Error(`attachments: ${error.message}`);
      }
      if (d.custom_statuses.length) {
        const { error } = await supabase.from('custom_statuses').upsert(d.custom_statuses, { onConflict: 'id' });
        if (error) throw new Error(`custom_statuses: ${error.message}`);
      }
      if (d.chat_categories.length) {
        const { error } = await supabase.from('chat_categories').upsert(d.chat_categories, { onConflict: 'id' });
        if (error) throw new Error(`chat_categories: ${error.message}`);
      }
      if (d.chat_messages.length) {
        const { error } = await supabase.from('chat_messages').upsert(d.chat_messages, { onConflict: 'id' });
        if (error) throw new Error(`chat_messages: ${error.message}`);
      }
      if (d.chat_reactions?.length) {
        const { error } = await supabase.from('chat_reactions').upsert(d.chat_reactions, { onConflict: 'id' });
        if (error) throw new Error(`chat_reactions: ${error.message}`);
      }
      if (d.direct_conversations?.length) {
        const { error } = await supabase.from('direct_conversations').upsert(d.direct_conversations, { onConflict: 'id' });
        if (error) throw new Error(`direct_conversations: ${error.message}`);
      }
      if (d.direct_conversation_members?.length) {
        await supabase.from('direct_conversation_members').delete().neq('conversation_id', '___none___');
        const { error } = await supabase.from('direct_conversation_members').insert(d.direct_conversation_members);
        if (error) throw new Error(`direct_conversation_members: ${error.message}`);
      }
      if (d.direct_messages?.length) {
        const { error } = await supabase.from('direct_messages').upsert(d.direct_messages, { onConflict: 'id' });
        if (error) throw new Error(`direct_messages: ${error.message}`);
      }
      if (d.dm_reactions?.length) {
        const { error } = await supabase.from('dm_reactions').upsert(d.dm_reactions, { onConflict: 'id' });
        if (error) throw new Error(`dm_reactions: ${error.message}`);
      }

      toast.success('Import terminé — rechargez la page pour voir les changements');
      setImportPreview(null);
    } catch (err: any) {
      toast.error(`Erreur d'import : ${err.message}`);
      console.error(err);
    }
    setImporting(false);
  };

  const counts = importPreview ? {
    spaces: importPreview.spaces.length,
    projects: importPreview.projects.length,
    tasks: importPreview.tasks.length,
    members: importPreview.team_members.length,
    comments: importPreview.comments.length,
    checklists: importPreview.checklist_items.length,
    chatCategories: importPreview.chat_categories.length,
    chatMessages: importPreview.chat_messages.length,
    chatReactions: (importPreview.chat_reactions || []).length,
    directMessages: (importPreview.direct_messages || []).length,
    dmReactions: (importPreview.dm_reactions || []).length,
    statuses: importPreview.custom_statuses.length,
  } : null;

  return (
    <div className="space-y-4">
      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Exporter les données</CardTitle>
          <p className="text-sm text-muted-foreground">
            Téléchargez un fichier JSON contenant tous vos espaces, projets, tâches, sous-tâches, responsables, avancements, chat, messages privés, réactions et catégories.
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={handleExport} disabled={exporting || exportingCsv} className="gap-2">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Export en cours…' : 'Exporter tout (JSON)'}
          </Button>
          <Button variant="outline" onClick={handleExportCsv} disabled={exporting || exportingCsv} className="gap-2">
            {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {exportingCsv ? 'Export en cours…' : 'Exporter les tâches (CSV)'}
          </Button>
        </CardContent>
      </Card>

      {/* Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importer des données</CardTitle>
          <p className="text-sm text-muted-foreground">
            Importez un fichier JSON précédemment exporté. Les données existantes avec le même ID seront mises à jour.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileSelect}
          />
          {!importPreview ? (
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
              <Upload className="w-4 h-4" />
              Choisir un fichier JSON
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1.5">
                <p className="text-sm font-medium text-foreground">Aperçu de l'import</p>
                <p className="text-xs text-muted-foreground">Exporté le {new Date(importPreview.exportedAt).toLocaleDateString('fr-FR')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1.5">
                  {[
                    ['Espaces', counts!.spaces],
                    ['Projets', counts!.projects],
                    ['Tâches', counts!.tasks],
                    ['Membres', counts!.members],
                    ['Commentaires', counts!.comments],
                    ['Checklist', counts!.checklists],
                    ['Catégories chat', counts!.chatCategories],
                    ['Messages chat', counts!.chatMessages],
                    ['Réactions chat', counts!.chatReactions],
                    ['Messages privés', counts!.directMessages],
                    ['Réactions DM', counts!.dmReactions],
                    ['Statuts perso.', counts!.statuses],
                  ].map(([label, count]) => (
                    <div key={label as string} className="text-xs">
                      <span className="text-muted-foreground">{label} : </span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  L'import mettra à jour les données existantes et ajoutera les nouvelles. Cette action est irréversible.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImport} disabled={importing} className="gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Import en cours…' : 'Confirmer l\'import'}
                </Button>
                <Button variant="outline" onClick={() => setImportPreview(null)} disabled={importing}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* CSV Import */}
      <CsvTaskImport />
    </div>
  );
}
