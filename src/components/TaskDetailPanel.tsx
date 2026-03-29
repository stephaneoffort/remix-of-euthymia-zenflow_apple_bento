import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { useApp } from '@/context/AppContext';
import { Status, Priority, PRIORITY_LABELS, RECURRENCE_LABELS, Recurrence } from '@/types';
import { PriorityBadge, StatusBadge, AvatarGroup, SubtaskProgress, StatusCircle } from '@/components/TaskBadges';
import { X, ChevronRight, Plus, CheckCircle, Circle, MessageSquare, Sparkles, Clock, Paperclip, ChevronDown, Maximize2, Minimize2, CalendarPlus, Link, Upload, Trash2, ExternalLink, FileText, Send, CalendarIcon, Repeat, FolderInput, PackagePlus, GitBranchPlus, Bell } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { generateGoogleCalendarUrl, generateOutlookCalendarUrl, generateYahooCalendarUrl } from '@/lib/calendarLinks';
import { supabase } from '@/integrations/supabase/client';
import TaskChecklist from '@/components/TaskChecklist';
import RichTextEditor, { RichTextDisplay } from '@/components/RichTextEditor';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Switch } from '@/components/ui/switch';
import TaskReminders from '@/components/TaskReminders';
import DriveAttachments from '@/components/drive/DriveAttachments';
import CanvaAttachments from '@/components/canva/CanvaAttachments';
import ZoomMeetings from '@/components/zoom/ZoomMeetings';
import BrevoContacts from '@/components/brevo/BrevoContacts';
import { useIntegrations, INTEGRATION_CONFIG } from '@/hooks/useIntegrations';
// Format date for display
function formatDateDisplay(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Format time for input (HH:mm)
function formatTimeValue(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '00:00';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Check if a date has a non-midnight time
function hasTime(isoStr: string | null | undefined): boolean {
  if (!isoStr) return false;
  const d = new Date(isoStr);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

// Build ISO from date + optional time
function buildISO(date: Date, time?: string): string {
  const d = new Date(date);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.toISOString();
}
function DateTimeField({ value, onChange }: { value: string | null | undefined; onChange: (val: string | null) => void }) {
  const [showTime, setShowTime] = useState(() => hasTime(value));
  const dateObj = value ? new Date(value) : undefined;
  const isValid = dateObj && !isNaN(dateObj.getTime());

  const handleDateSelect = (day: Date | undefined) => {
    if (!day) { onChange(null); return; }
    if (showTime && isValid) {
      onChange(buildISO(day, formatTimeValue(value!)));
    } else {
      onChange(buildISO(day));
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isValid || !dateObj) return;
    onChange(buildISO(dateObj, e.target.value));
  };

  const handleToggleTime = (checked: boolean) => {
    setShowTime(checked);
    if (!checked && isValid && dateObj) {
      // Remove time → set to midnight
      onChange(buildISO(dateObj));
    }
  };

  const handleClear = () => {
    onChange(null);
    setShowTime(false);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal text-sm h-9 dark:bg-muted dark:text-foreground dark:hover:bg-muted/80 transition-colors",
                !isValid && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {isValid ? format(dateObj!, 'dd MMM yyyy', { locale: fr }) : 'Choisir une date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={isValid ? dateObj : undefined}
              onSelect={handleDateSelect}
              initialFocus
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        {isValid && (
          <button onClick={handleClear} className="text-muted-foreground hover:text-foreground p-1">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {isValid && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Switch checked={showTime} onCheckedChange={handleToggleTime} className="scale-75" />
            <span className="text-xs text-muted-foreground">Heure</span>
          </div>
          {showTime && (
            <input
              type="time"
              value={formatTimeValue(value!)}
              onChange={handleTimeChange}
              className="text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
            />
          )}
        </div>
      )}
    </div>
  );
}


export default function TaskDetailPanel() {
  const { selectedTaskId, setSelectedTaskId, setSelectedProjectId, getTaskById, updateTask, deleteTask, getSubtasks, addTask, getTaskBreadcrumb, getMemberById, tasks, teamMembers, allStatuses, getStatusLabel, addAttachment, deleteAttachment, projects, spaces, getListsForProject, convertTaskToProject } = useApp();
  const { isActive } = useIntegrations();
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkName, setNewLinkName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const task = selectedTaskId ? getTaskById(selectedTaskId) : null;

  useEffect(() => {
    setDescriptionDraft(task?.description ?? '');
  }, [task?.id, task?.description]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const debouncedSaveDescription = useCallback((html: string, taskId: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateTask(taskId, { description: html });
    }, 1500);
  }, [updateTask]);

  if (!selectedTaskId) return null;
  if (!task) return null;

  const breadcrumb = getTaskBreadcrumb(task.id);
  const subtasks = getSubtasks(task.id);
  const doneSubtasks = subtasks.filter(t => t.status === 'done');
  const allSubtasksDone = subtasks.length > 0 && doneSubtasks.length === subtasks.length;

  const handleAddSubtask = (parentId: string) => {
    if (!newSubtaskTitle.trim()) return;
    addTask({
      title: newSubtaskTitle.trim(),
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: parentId,
      listId: task.listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewSubtaskTitle('');
    setAddingSubtaskFor(null);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    updateTask(task.id, {
      comments: [...task.comments, {
        id: `c_${Date.now()}`,
        authorId: 'tm1',
        content: newComment.trim(),
        createdAt: new Date().toISOString(),
      }],
    });
    setNewComment('');
  };

  const toggleSubtaskStatus = (subtaskId: string) => {
    const st = getTaskById(subtaskId);
    if (!st) return;
    updateTask(subtaskId, { status: st.status === 'done' ? 'todo' : 'done' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${task.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('task-attachments').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(filePath);
        addAttachment(task.id, file.name, publicUrl);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddLink = () => {
    if (!newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const name = newLinkName.trim() || new URL(url).hostname;
    addAttachment(task.id, name, url);
    setNewLinkUrl('');
    setNewLinkName('');
    setAddingLink(false);
  };

  const isLink = (url: string) => /^https?:\/\//i.test(url) && !url.includes('task-attachments');

  return (
    <div className={`flex flex-col h-full border-l border-border shadow-xl task-detail-panel ${
      expanded ? 'fixed inset-0 z-[60]' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs text-foreground/60 min-w-0 overflow-x-auto">
          {breadcrumb.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
              <button
                onClick={() => setSelectedTaskId(t.id)}
                className={`truncate hover:text-foreground transition-colors whitespace-nowrap ${t.id === task.id ? 'text-foreground font-medium' : ''}`}
              >
                {t.title}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {/* Convert to project */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-md transition-colors"
                title="Convertir en projet"
              >
                <PackagePlus className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Convertir en projet dans…</div>
              {spaces.map(s => (
                <DropdownMenuItem
                  key={s.id}
                  onClick={() => {
                    convertTaskToProject(task.id, s.id);
                    setSelectedTaskId(null);
                  }}
                >
                  <span className="mr-2">{s.icon}</span>
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            onClick={() => {
              if (window.confirm('Supprimer cette tâche et ses sous-tâches ?')) {
                const parentId = task.parentTaskId;
                deleteTask(task.id);
                setSelectedTaskId(parentId || null);
              }
            }}
            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors"
            title="Supprimer la tâche"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(!expanded)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors hidden sm:flex" title={expanded ? 'Réduire' : 'Agrandir'}>
            {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setSelectedTaskId(null)} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto scrollbar-thin p-3 sm:p-5 ${expanded ? 'max-w-5xl mx-auto w-full' : ''}`}>
        <div className={expanded ? 'grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6' : 'space-y-4 sm:space-y-6'}>

          {/* === Column 1: Main info === */}
          <div className="space-y-4 sm:space-y-6">
            {/* Title */}
            <input
              value={task.title}
              onChange={e => updateTask(task.id, { title: e.target.value })}
              className={`font-bold text-foreground bg-transparent w-full outline-none border-none ${expanded ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}
            />

            {/* Meta fields */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Statut</label>
                <select
                  value={task.status}
                  onChange={e => updateTask(task.id, { status: e.target.value as Status })}
                  className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  {allStatuses.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Priorité</label>
                <select
                  value={task.priority}
                  onChange={e => updateTask(task.id, { priority: e.target.value as Priority })}
                  className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Date de début</label>
                <DateTimeField
                  value={task.startDate}
                  onChange={(val) => updateTask(task.id, { startDate: val })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Échéance</label>
                <DateTimeField
                  value={task.dueDate}
                  onChange={(val) => updateTask(task.id, { dueDate: val })}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block">
                  <Repeat className="w-3 h-3" /> Récurrence
                </label>
                <select
                  value={task.recurrence || ''}
                  onChange={e => updateTask(task.id, { recurrence: (e.target.value || null) as Recurrence })}
                  className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Aucune</option>
                  {Object.entries(RECURRENCE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                {task.recurrence && (
                  <div className="mt-2 space-y-1.5">
                    <label className="text-xs text-foreground/60">Fin de récurrence (optionnel)</label>
                    <DateTimeField
                      value={task.recurrenceEndDate}
                      onChange={(val) => updateTask(task.id, { recurrenceEndDate: val })}
                    />
                    <p className="text-xs text-foreground/60">
                      {task.recurrenceEndDate
                        ? `La récurrence s'arrêtera après le ${format(new Date(task.recurrenceEndDate), 'dd MMM yyyy', { locale: fr })}.`
                        : 'Une nouvelle tâche sera créée automatiquement à chaque complétion, sans limite.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Move to project */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block">
                  <FolderInput className="w-3 h-3" /> Projet
                </label>
                {(() => {
                  // Find current project from task's listId
                  const currentList = projects.flatMap(p => getListsForProject(p.id).map(l => ({ ...l, project: p }))).find(l => l.id === task.listId);
                  const currentProjectId = currentList?.project?.id || '';
                  return (
                    <select
                      value={currentProjectId}
                       onChange={e => {
                        const targetProjectId = e.target.value;
                        if (targetProjectId === currentProjectId) return;
                        const targetLists = getListsForProject(targetProjectId);
                        if (targetLists.length === 0) return;
                        const targetProject = projects.find(p => p.id === targetProjectId);
                        const prevListId = task.listId;
                        const prevParentTaskId = task.parentTaskId;
                        updateTask(task.id, { listId: targetLists[0].id, parentTaskId: null });
                        setSelectedProjectId(targetProjectId);
                        toast({
                          title: 'Tâche déplacée',
                          description: `« ${task.title} » → ${targetProject?.name || 'projet'}`,
                          action: <ToastAction altText="Annuler" onClick={() => { updateTask(task.id, { listId: prevListId, parentTaskId: prevParentTaskId }); }}>Annuler</ToastAction>,
                        });
                      }}
                      className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                    >
                      {projects.map(p => {
                        const space = spaces.find(s => s.id === p.spaceId);
                        return (
                          <option key={p.id} value={p.id}>
                            {space ? `${space.name} › ` : ''}{p.name}
                          </option>
                        );
                      })}
                    </select>
                  );
                })()}
              </div>

              {/* Make subtask of another task */}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1 block">
                  <GitBranchPlus className="w-3 h-3" /> Tâche parente
                </label>
                <select
                  value={task.parentTaskId || ''}
                  onChange={e => {
                    const parentId = e.target.value || null;
                    if (parentId === task.parentTaskId) return;
                    if (parentId === task.id) return;
                    const parentTask = parentId ? tasks.find(t => t.id === parentId) : null;
                    const prevParentId = task.parentTaskId;
                    const prevListId = task.listId;
                    updateTask(task.id, { parentTaskId: parentId, ...(parentTask ? { listId: parentTask.listId } : {}) });
                    toast({
                      title: parentId ? 'Sous-tâche définie' : 'Tâche détachée',
                      description: parentId
                        ? `« ${task.title} » est maintenant sous-tâche de « ${parentTask?.title} »`
                        : `« ${task.title} » est maintenant une tâche indépendante`,
                      action: <ToastAction altText="Annuler" onClick={() => { updateTask(task.id, { parentTaskId: prevParentId, listId: prevListId }); }}>Annuler</ToastAction>,
                    });
                  }}
                  className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2 sm:px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— Aucune (tâche indépendante)</option>
                  {tasks
                    .filter(t => t.id !== task.id && t.parentTaskId !== task.id)
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Assignees */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Assignée à</label>
              <div className="space-y-1">
                {teamMembers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={task.assigneeIds.includes(m.id)}
                      onChange={e => {
                        const ids = e.target.checked
                          ? [...task.assigneeIds, m.id]
                          : task.assigneeIds.filter(id => id !== m.id);
                        updateTask(task.id, { assigneeIds: ids });
                      }}
                      className="rounded border-border"
                    />
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-label font-bold" style={{ backgroundColor: m.avatarColor, color: 'white' }}>
                      {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="truncate" style={{ color: '#777269' }}>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
              <RichTextEditor
                key={task.id}
                content={descriptionDraft}
                onChange={(html) => {
                  setDescriptionDraft(html);
                  debouncedSaveDescription(html, task.id);
                }}
                onBlur={(html) => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  if (html !== task.description) {
                    updateTask(task.id, { description: html });
                  }
                }}
                placeholder="Ajouter une description..."
                editorClassName={expanded ? 'min-h-[120px]' : 'min-h-[60px]'}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Tags</label>
              <div className="flex gap-1 flex-wrap">
                {task.tags.map(tag => (
                  <span key={tag} className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">{tag}</span>
                ))}
                <input
                  placeholder="+ tag"
                  className="text-xs bg-transparent border-none outline-none w-16 placeholder:text-muted-foreground"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (!task.tags.includes(val)) {
                        updateTask(task.id, { tags: [...task.tags, val] });
                      }
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
            </div>

            {/* Rappels */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 block">
                <Bell className="w-3 h-3" /> Rappels
              </label>
              <TaskReminders
                taskId={task.id}
                hasStartDate={!!task.startDate}
                hasDueDate={!!task.dueDate}
              />
            </div>

            {/* Attachments & Links */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Paperclip className="w-3 h-3" /> Pièces jointes ({task.attachments.length})
              </label>

              {task.attachments.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {task.attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 group px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors">
                      {isLink(att.url) ? (
                        <Link className="w-3.5 h-3.5 text-primary shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-foreground hover:text-primary truncate flex-1 transition-colors"
                      >
                        {att.name}
                      </a>
                      <ExternalLink className="w-3 h-3 text-foreground/45 opacity-60 group-hover:opacity-100 shrink-0 transition-opacity" />
                      <button
                        onClick={() => deleteAttachment(att.id)}
                        className="p-0.5 opacity-60 group-hover:opacity-100 text-foreground/45 hover:text-destructive transition-all shrink-0"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add link form */}
              {addingLink && (
                <div className="space-y-1.5 mb-2">
                  <input
                    autoFocus
                    value={newLinkUrl}
                    onChange={e => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddLink();
                      if (e.key === 'Escape') { setAddingLink(false); setNewLinkUrl(''); setNewLinkName(''); }
                    }}
                  />
                  <input
                    value={newLinkName}
                    onChange={e => setNewLinkName(e.target.value)}
                    placeholder="Nom du lien (optionnel)"
                    className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddLink();
                      if (e.key === 'Escape') { setAddingLink(false); setNewLinkUrl(''); setNewLinkName(''); }
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleAddLink} disabled={!newLinkUrl.trim()} className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50">
                      Ajouter
                    </button>
                    <button onClick={() => { setAddingLink(false); setNewLinkUrl(''); setNewLinkName(''); }} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  id="task-file-upload"
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="sr-only"
                />
                <label
                  htmlFor="task-file-upload"
                  aria-disabled={uploading}
                  className={`inline-flex items-center gap-1 text-xs transition-colors ${uploading ? 'pointer-events-none text-foreground/35' : 'cursor-pointer text-foreground/60 hover:text-foreground'}`}
                >
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'Envoi...' : 'Fichier'}
                </label>
                <button
                  onClick={() => setAddingLink(true)}
                  className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground transition-colors"
                >
                  <Link className="w-3.5 h-3.5" /> Lien
                </button>
              </div>
            </div>

            {/* Integrations */}
            <DriveAttachments entityType="task" entityId={task.id} compact />
            <CanvaAttachments entityType="task" entityId={task.id} compact defaultTitle={task.title} />
            <ZoomMeetings entityType="task" entityId={task.id} compact defaultTitle={task.title} />
            <BrevoContacts entityType="task" entityId={task.id} compact />

            {!isActive('google_drive') && !isActive('canva') && !isActive('zoom') && !isActive('brevo') && (
              <a
                href="/settings"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
              >
                <img src={INTEGRATION_CONFIG.google_drive.icon} alt="" className="w-5 h-5" />
                <img src={INTEGRATION_CONFIG.canva.icon} alt="" className="w-5 h-5" />
                <img src={INTEGRATION_CONFIG.zoom.icon} alt="" className="w-5 h-5" />
                <img src={INTEGRATION_CONFIG.brevo.icon} alt="" className="w-5 h-5" />
                <span>— Connecte des outils depuis les Settings →</span>
              </a>
            )}

            {/* Time */}
            <div className="flex gap-3 sm:gap-4">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Estimation (min)</label>
                <input type="number" value={task.timeEstimate || ''} onChange={e => updateTask(task.id, { timeEstimate: e.target.value ? parseInt(e.target.value) : null })} className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Temps passé (min)</label>
                <input type="number" value={task.timeLogged || ''} onChange={e => updateTask(task.id, { timeLogged: e.target.value ? parseInt(e.target.value) : null })} className="w-full text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>

            {/* AI Summary */}
            {task.aiSummary && (
              <div className="bg-accent/50 border border-accent rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground mb-1">
                  <Sparkles className="w-3.5 h-3.5" /> Résumé IA
                </div>
                <p className="text-sm text-foreground">{task.aiSummary}</p>
              </div>
            )}

            {/* AI Buttons + Calendar */}
            <div className="flex gap-2 flex-wrap">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> Résumé IA
              </button>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Sparkles className="w-3.5 h-3.5" /> Sous-tâches IA
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/80 transition-colors">
                    <CalendarPlus className="w-3.5 h-3.5" /> Ajouter à l'agenda
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem asChild>
                    <a href={generateGoogleCalendarUrl(task)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google Agenda
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={generateOutlookCalendarUrl(task)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0078D4"><path d="M24 7.387v10.478c0 .23-.08.424-.238.576a.806.806 0 0 1-.588.234h-8.55v-12.7h8.55c.23 0 .424.08.588.237A.786.786 0 0 1 24 6.79v.597zM13.7 5.975v12.7H.624V5.975L7.162 2l6.538 3.975zM7.162 8.6c-.87 0-1.588.307-2.154.921-.566.614-.849 1.387-.849 2.317 0 .914.28 1.675.84 2.283.56.608 1.272.912 2.135.912.875 0 1.597-.3 2.166-.9.57-.6.854-1.37.854-2.311 0-.93-.281-1.703-.843-2.317-.562-.614-1.28-.921-2.149-.905z"/></svg>
                      Outlook
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={generateYahooCalendarUrl(task)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#6001D2"><path d="M14.845 8.51l-4.553 6.282h4.554L12.8 19.5H5.5l4.553-6.282H5.5L7.546 8.51h7.299z"/></svg>
                      Yahoo Agenda
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* === Column 2 (or continues below in non-expanded): Subtasks + Comments === */}
          <div className="space-y-4 sm:space-y-6">
            {/* Checklist */}
            <TaskChecklist taskId={task.id} />

            {/* Subtasks */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-foreground/60 uppercase tracking-wider flex items-center gap-1">
                  Sous-tâches
                  {subtasks.length > 0 && <span className="text-foreground/60">({doneSubtasks.length}/{subtasks.length})</span>}
                </label>
              </div>

              {subtasks.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round((doneSubtasks.length / subtasks.length) * 100)}%`,
                        backgroundColor: doneSubtasks.length === subtasks.length ? 'hsl(142, 71%, 45%)' : 'hsl(var(--primary))',
                      }}
                    />
                  </div>
                  <span className="text-xs text-foreground/60 tabular-nums">{Math.round((doneSubtasks.length / subtasks.length) * 100)}%</span>
                </div>
              )}

              {allSubtasksDone && task.status !== 'done' && (
                <div className="bg-status-done/10 border border-status-done/30 rounded-lg p-2.5 mb-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <span className="text-xs text-status-done font-medium">Toutes les sous-tâches terminées. Marquer comme terminée ?</span>
                  <button
                    onClick={() => updateTask(task.id, { status: 'done' })}
                    className="text-xs bg-status-done text-primary-foreground px-2.5 py-1 rounded-md font-medium hover:opacity-90 shrink-0"
                  >
                    Terminer
                  </button>
                </div>
              )}

              {subtasks.length > 0 && (
                <SubtaskTree taskId={task.id} depth={0} />
              )}

              {/* Add subtask inline */}
              {addingSubtaskFor === task.id ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    autoFocus
                    value={newSubtaskTitle}
                    onChange={e => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddSubtask(task.id);
                      if (e.key === 'Escape') { setAddingSubtaskFor(null); setNewSubtaskTitle(''); }
                    }}
                    placeholder="Titre de la sous-tâche..."
                    className="flex-1 text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                  />
                  <button
                    onClick={() => handleAddSubtask(task.id)}
                    disabled={!newSubtaskTitle.trim()}
                    className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubtaskFor(task.id)}
                  className="inline-flex items-center gap-1 text-xs text-foreground/60 hover:text-foreground mt-2 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter une sous-tâche
                </button>
              )}
            </div>

            {/* Comments */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" /> Commentaires ({task.comments.length})
              </label>
              <div className="space-y-3 mb-3">
                {task.comments.map(c => {
                  const author = getMemberById(c.authorId);
                  return (
                    <div key={c.id} className="flex gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-label font-bold shrink-0 mt-0.5" style={{ backgroundColor: author?.avatarColor || '#888', color: 'white' }}>
                        {author?.name.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate">{author?.name || 'Inconnu'}</span>
                          <span className="text-xs text-foreground/50 shrink-0">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <RichTextDisplay content={c.content} className="text-sm mt-0.5 break-words" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="space-y-2">
                <RichTextEditor
                  content={newComment}
                  onChange={setNewComment}
                  placeholder="Écrire un commentaire..."
                  className="text-sm"
                  editorClassName="min-h-[38px]"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || newComment === '<p></p>'}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50 shrink-0"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SubtaskTree({ taskId, depth }: { taskId: string; depth: number }) {
  const { getSubtasks, getTaskById, updateTask, deleteTask, setSelectedTaskId, addTask, getMemberById } = useApp();
  const subtasks = getSubtasks(taskId);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(subtasks.map(s => s.id)));

  const parentTask = getTaskById(taskId);

  const handleAdd = (parentId: string) => {
    if (!newTitle.trim() || !parentTask) return;
    addTask({
      title: newTitle.trim(),
      description: '',
      status: 'todo',
      priority: 'normal',
      dueDate: null,
      startDate: null,
      assigneeIds: [],
      tags: [],
      parentTaskId: parentId,
      listId: parentTask.listId,
      comments: [],
      attachments: [],
      timeEstimate: null,
      timeLogged: null,
      aiSummary: null,
    });
    setNewTitle('');
    setAddingFor(null);
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1" style={{ paddingLeft: depth > 0 ? `${Math.min(depth * 12, 36)}px` : '0' }}>
      {subtasks.map(st => {
        const children = getSubtasks(st.id);
        const doneChildren = children.filter(c => c.status === 'done');
        const hasChildren = children.length > 0;
        const isExpanded = expandedNodes.has(st.id);
        const isOverdue = st.dueDate && st.dueDate < new Date().toISOString().split('T')[0] && st.status !== 'done';

        return (
          <div key={st.id}>
            <div
              className={`rounded-md hover:bg-muted/50 group transition-colors cursor-pointer ${isOverdue ? 'border-l-2 border-l-priority-urgent' : ''}`}
              onClick={() => setSelectedTaskId(st.id)}
            >
              <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 px-1.5 sm:px-2">
                {hasChildren ? (
                  <button onClick={e => { e.stopPropagation(); toggleExpand(st.id); }} className="p-0.5 shrink-0">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                ) : <span className="w-4.5 shrink-0" />}
                <button
                  onClick={e => { e.stopPropagation(); updateTask(st.id, { status: st.status === 'done' ? 'todo' : 'done' }); }}
                  className="shrink-0"
                >
                  <StatusCircle status={st.status} />
                </button>
                <span
                  className={`flex-1 text-left text-sm truncate ${st.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'} hover:text-primary transition-colors min-w-0`}
                >
                  {st.title}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setAddingFor(st.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (window.confirm('Supprimer cette sous-tâche ?')) deleteTask(st.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 rounded shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              {/* Metadata row */}
              <div className="flex items-center gap-1.5 flex-wrap pl-[30px] sm:pl-[34px] pb-1.5 text-xs">
                <PriorityBadge priority={st.priority} />
                {st.dueDate && (
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded transition-colors cursor-default dark:bg-muted dark:text-foreground dark:hover:bg-accent ${isOverdue ? 'text-priority-urgent font-medium' : 'subtask-date'}`}
                  >
                    {new Date(st.dueDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {hasChildren && (
                  <SubtaskProgress total={children.length} done={doneChildren.length} />
                )}
                <div className="ml-auto">
                  <AvatarGroup memberIds={st.assigneeIds} getMemberById={getMemberById} />
                </div>
              </div>
            </div>

            {addingFor === st.id && (
              <div className="flex items-center gap-2 mt-1" style={{ paddingLeft: '28px' }}>
                <input
                  autoFocus
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAdd(st.id);
                    if (e.key === 'Escape') { setAddingFor(null); setNewTitle(''); }
                  }}
                  onBlur={() => { if (!newTitle.trim()) { setAddingFor(null); setNewTitle(''); } }}
                  placeholder="Sous-tâche..."
                  className="flex-1 text-sm text-foreground bg-muted/50 border border-border rounded-md px-2.5 py-1 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
                />
                <button
                  onClick={() => handleAdd(st.id)}
                  disabled={!newTitle.trim()}
                  className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            )}

            {isExpanded && hasChildren && (
              <SubtaskTree taskId={st.id} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}
