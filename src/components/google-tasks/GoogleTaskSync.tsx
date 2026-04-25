import { useState, useEffect, useCallback } from "react"
import { Loader2, ExternalLink, RefreshCw, Unlink, ListPlus } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import googleTasksIcon from "@/assets/integrations/google-tasks.png"
import { cn } from "@/lib/utils"

interface GoogleTaskList {
  id: string
  title: string
}

interface ExistingLink {
  google_task_id: string
  google_tasklist_id: string
  last_synced_at: string
}

interface AppTask {
  id: string
  title: string
  description?: string | null
  dueDate?: string | null
  status?: string | null
}

interface Props {
  task: AppTask
  className?: string
}

const LAST_LIST_KEY = "google_tasks:last_list_id"

export default function GoogleTaskSync({ task, className }: Props) {
  const { toast } = useToast()
  const [link, setLink] = useState<ExistingLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke("google-tasks-api", {
      body: { action: "list_links", app_task_ids: [task.id] },
    })
    if (!error && data?.links?.length > 0) {
      setLink(data.links[0])
    } else {
      setLink(null)
    }
    setLoading(false)
  }, [task.id])

  useEffect(() => { refresh() }, [refresh])

  const handlePushed = async () => {
    setDialogOpen(false)
    await refresh()
  }

  const handleUnlink = async () => {
    const { error } = await supabase.functions.invoke("google-tasks-api", {
      body: { action: "unlink_task", app_task_id: task.id },
    })
    if (error) {
      toast({ title: "Erreur", description: "Impossible de retirer le lien.", variant: "destructive" })
      return
    }
    setLink(null)
    toast({ title: "Lien Google Tasks retiré" })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <img src={googleTasksIcon} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" width={14} height={14} />
          Google Tasks
        </span>
        {!loading && (
          link ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setDialogOpen(true)}
                title="Pousser à nouveau pour mettre à jour"
              >
                <RefreshCw className="w-3 h-3" /> Sync
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                onClick={handleUnlink}
              >
                <Unlink className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => setDialogOpen(true)}
            >
              <ListPlus className="w-3 h-3" /> Pousser
            </Button>
          )
        )}
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : link ? (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Liée à Google Tasks · dernière sync {new Date(link.last_synced_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">
          Pas encore poussée vers Google Tasks.
        </p>
      )}

      <PushDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={task}
        existingLink={link}
        onPushed={handlePushed}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Push dialog : choisir une liste et envoyer
// ─────────────────────────────────────────────────────────────────────────────

interface PushProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  task: AppTask
  existingLink: ExistingLink | null
  onPushed: () => void
}

function PushDialog({ open, onOpenChange, task, existingLink, onPushed }: PushProps) {
  const { toast } = useToast()
  const [tasklists, setTasklists] = useState<GoogleTaskList[]>([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [selectedListId, setSelectedListId] = useState<string>("")
  const [pushing, setPushing] = useState(false)

  // Précharger la liste précédente OU le mapping existant
  useEffect(() => {
    if (!open) return
    const initial = existingLink?.google_tasklist_id
      ?? localStorage.getItem(LAST_LIST_KEY)
      ?? ""
    setSelectedListId(initial)
  }, [open, existingLink])

  // Charger les listes Google
  useEffect(() => {
    if (!open) return
    setLoadingLists(true)
    supabase.functions.invoke("google-tasks-api", {
      body: { action: "list_tasklists" },
    }).then(({ data, error }) => {
      setLoadingLists(false)
      if (error || data?.error) {
        toast({
          title: "Erreur",
          description: data?.error ?? "Impossible de charger vos listes Google Tasks.",
          variant: "destructive",
        })
        return
      }
      setTasklists(data?.tasklists ?? [])
      // Si rien de présélectionné, prendre la 1ère
      if (!selectedListId && (data?.tasklists?.length ?? 0) > 0) {
        setSelectedListId(data.tasklists[0].id)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handlePush = async () => {
    if (!selectedListId) return
    setPushing(true)
    const { data, error } = await supabase.functions.invoke("google-tasks-api", {
      body: {
        action: "push_task",
        app_task_id: task.id,
        tasklist_id: selectedListId,
        title: task.title,
        notes: task.description ?? null,
        due: task.dueDate ?? null,
        completed: task.status === "done",
      },
    })
    setPushing(false)
    if (error || data?.error) {
      toast({
        title: "Erreur",
        description: data?.error ?? "Échec du push vers Google Tasks.",
        variant: "destructive",
      })
      return
    }
    localStorage.setItem(LAST_LIST_KEY, selectedListId)
    toast({ title: "Tâche poussée vers Google Tasks" })
    onPushed()
  }

  const isUpdate = !!existingLink && existingLink.google_tasklist_id === selectedListId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={googleTasksIcon} alt="" className="w-5 h-5 object-contain" loading="lazy" width={20} height={20} />
            Pousser vers Google Tasks
          </DialogTitle>
          <DialogDescription>
            La tâche sera créée (ou mise à jour) dans la liste choisie. Le titre,
            la description et la date d'échéance sont copiés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Liste de destination</label>
            {loadingLists ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Chargement de vos listes…
              </div>
            ) : tasklists.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Aucune liste trouvée. Créez-en une depuis{" "}
                <a
                  href="https://tasks.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline inline-flex items-center gap-0.5"
                >
                  tasks.google.com <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </p>
            ) : (
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une liste" />
                </SelectTrigger>
                <SelectContent>
                  {tasklists.map(list => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {existingLink && existingLink.google_tasklist_id !== selectedListId && (
            <p className="text-[11px] text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
              ⚠️ Cette tâche est déjà liée à une autre liste. La pousser ici créera une seconde copie côté Google.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handlePush} disabled={!selectedListId || pushing}>
            {pushing && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {isUpdate ? "Mettre à jour" : "Pousser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
