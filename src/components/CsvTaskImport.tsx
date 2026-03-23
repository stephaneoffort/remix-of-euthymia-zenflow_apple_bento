import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Loader2, AlertTriangle, FileSpreadsheet, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApp } from '@/context/AppContext';

interface CsvRow {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  due_date?: string;
  start_date?: string;
  tags?: string;
  time_estimate?: string;
  recurrence?: string;
}

const CSV_COLUMNS = ['title', 'description', 'status', 'priority', 'due_date', 'start_date', 'tags', 'time_estimate', 'recurrence'];

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const firstLine = lines[0];
  const sep = firstLine.includes(';') ? ';' : ',';

  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], sep);
    if (!values.length) continue;
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim().replace(/^["']|["']$/g, '') || '';
    });
    if (row.title) rows.push(row as CsvRow);
  }
  return rows;
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export default function CsvTaskImport() {
  const { spaces, projects, getListsForProject } = useApp();
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Build a flat list of all lists grouped by space > project
  const allLists = projects.flatMap(p => {
    const lists = getListsForProject(p.id);
    const space = spaces.find(s => s.id === p.spaceId);
    return lists.map(l => ({
      id: l.id,
      label: `${space?.name || '?'} › ${p.name} › ${l.name}`,
    }));
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCsv(text);
        if (!rows.length) {
          toast.error('Aucune tâche trouvée dans le CSV. Vérifiez que la colonne "title" existe.');
          return;
        }
        setCsvRows(rows);
      } catch {
        toast.error('Impossible de lire le fichier CSV');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleImport = async () => {
    if (!csvRows.length || !selectedListId) return;
    setImporting(true);
    try {
      const validStatuses = ['todo', 'in_progress', 'in_review', 'done', 'blocked'];
      const validPriorities = ['urgent', 'high', 'normal', 'low'];
      const validRecurrences = ['daily', 'weekly', 'monthly'];

      const tasksToInsert = csvRows.map((row, idx) => ({
        title: row.title,
        description: row.description || '',
        status: validStatuses.includes(row.status || '') ? row.status! : 'todo',
        priority: validPriorities.includes(row.priority || '') ? row.priority! : 'normal',
        due_date: row.due_date && !isNaN(Date.parse(row.due_date)) ? new Date(row.due_date).toISOString() : null,
        start_date: row.start_date && !isNaN(Date.parse(row.start_date)) ? new Date(row.start_date).toISOString() : null,
        tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        time_estimate: row.time_estimate ? parseInt(row.time_estimate, 10) || null : null,
        recurrence: validRecurrences.includes(row.recurrence || '') ? row.recurrence! : null,
        list_id: selectedListId,
        sort_order: idx,
      }));

      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw new Error(error.message);

      toast.success(`${tasksToInsert.length} tâche(s) importée(s) — rechargez la page pour voir les changements`);
      setCsvRows([]);
      setSelectedListId('');
    } catch (err: any) {
      toast.error(`Erreur d'import CSV : ${err.message}`);
      console.error(err);
    }
    setImporting(false);
  };

  const downloadTemplate = () => {
    const header = CSV_COLUMNS.join(',');
    const example = 'Ma première tâche,Description ici,todo,normal,2025-12-31,,tag1 tag2,60,';
    const blob = new Blob([header + '\n' + example + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'euthymia-tasks-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Importer des tâches depuis un CSV
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Importez un fichier CSV avec les colonnes : <code className="text-xs bg-muted px-1 py-0.5 rounded">title</code> (obligatoire), <code className="text-xs bg-muted px-1 py-0.5 rounded">description</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">status</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">priority</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">due_date</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">start_date</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">tags</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">time_estimate</code>, <code className="text-xs bg-muted px-1 py-0.5 rounded">recurrence</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="ghost" size="sm" onClick={downloadTemplate} className="gap-2 text-xs">
          <Download className="w-3 h-3" />
          Télécharger un modèle CSV
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />

        {!csvRows.length ? (
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" />
            Choisir un fichier CSV
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
              <p className="text-sm font-medium text-foreground">
                {csvRows.length} tâche(s) détectée(s)
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {csvRows.slice(0, 20).map((row, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="font-medium text-foreground">{row.title}</span>
                    {row.status && <span className="bg-muted px-1 rounded">{row.status}</span>}
                    {row.priority && <span className="bg-muted px-1 rounded">{row.priority}</span>}
                  </div>
                ))}
                {csvRows.length > 20 && (
                  <p className="text-xs text-muted-foreground">…et {csvRows.length - 20} autres</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Liste de destination</label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une liste…" />
                </SelectTrigger>
                <SelectContent>
                  {allLists.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">
                Les tâches seront créées dans la liste sélectionnée. Cette action est irréversible.
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing || !selectedListId} className="gap-2">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {importing ? 'Import en cours…' : `Importer ${csvRows.length} tâche(s)`}
              </Button>
              <Button variant="outline" onClick={() => { setCsvRows([]); setSelectedListId(''); }} disabled={importing}>
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
