import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, X, ExternalLink, RefreshCw, FilePlus2 } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import docsIcon from "@/assets/integrations/google-docs.png"
import { cn } from "@/lib/utils"

export interface GoogleDocLink {
  id: string
  google_doc_id: string
  title: string | null
  web_view_link: string | null
  preview_text: string | null
  preview_updated_at: string | null
  created_at: string
}

interface Props {
  taskId: string
  taskTitle: string
  className?: string
}

function isValidDocsInput(input: string): boolean {
  const v = input.trim()
  if (!v) return false
  if (v.includes("docs.google.com/document/d/")) return true
  // ID brut
  return /^[a-zA-Z0-9_-]{20,}$/.test(v)
}

export default function GoogleDocsAttachments({ taskId, taskTitle, className }: Props) {
  const { toast } = useToast()
  const [links, setLinks] = useState<GoogleDocLink[]>([])
  const [loading, setLoading] = useState(true)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke("google-docs-api", {
      body: { action: "list_links", app_task_ids: [taskId] },
    })
    if (!error && Array.isArray(data?.links)) {
      setLinks(data.links as GoogleDocLink[])
    } else {
      setLinks([])
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { refresh() }, [refresh])

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.functions.invoke("google-docs-api", {
      body: { action: "unlink", link_id: linkId },
    })
    if (error) {
      toast({ title: "Erreur", description: "Impossible de retirer le document.", variant: "destructive" })
      return
    }
    setLinks(prev => prev.filter(l => l.id !== linkId))
  }

  const handleCreate = async () => {
    setCreating(true)
    const { data, error } = await supabase.functions.invoke("google-docs-api", {
      body: { action: "create_doc", app_task_id: taskId, title: taskTitle || "Nouveau document" },
    })
    setCreating(false)
    if (error || data?.error) {
      toast({
        title: "Erreur",
        description: data?.error ?? "Impossible de créer le document.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Document créé et attaché" })
    refresh()
  }

  const handleRefreshPreview = async (linkId: string) => {
    setRefreshingId(linkId)
    const { data, error } = await supabase.functions.invoke("google-docs-api", {
      body: { action: "refresh_preview", link_id: linkId },
    })
    setRefreshingId(null)
    if (error || data?.error) {
      toast({
        title: "Erreur",
        description: data?.error ?? "Impossible de rafraîchir l'aperçu.",
        variant: "destructive",
      })
      return
    }
    refresh()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <img src={docsIcon} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" width={14} height={14} />
          Google Docs
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1">
              <Plus className="w-3 h-3" /> Ajouter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Lier un Doc existant
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCreate} disabled={creating}>
              {creating
                ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                : <FilePlus2 className="w-3.5 h-3.5 mr-2" />}
              Créer un nouveau Doc
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun document attaché.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map(link => (
            <li
              key={link.id}
              className="group rounded-md border border-border hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <img
                  src={docsIcon}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  loading="lazy"
                  width={16}
                  height={16}
                />
                <a
                  href={link.web_view_link ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm hover:underline truncate flex items-center gap-1.5"
                >
                  <span className="truncate">{link.title || "Document Google"}</span>
                  <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => handleRefreshPreview(link.id)}
                  aria-label="Rafraîchir l'aperçu"
                  title="Rafraîchir l'aperçu"
                  disabled={refreshingId === link.id}
                >
                  {refreshingId === link.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <RefreshCw className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  onClick={() => handleUnlink(link.id)}
                  aria-label="Retirer"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              {refreshingId === link.id ? (
                <p className="px-2 pb-1.5 text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Mise à jour de l'aperçu…
                </p>
              ) : link.preview_text ? (
                <p className="px-2 pb-1.5 text-[11px] text-muted-foreground line-clamp-2 italic">
                  {link.preview_text}
                </p>
              ) : (
                <p className="px-2 pb-1.5 text-[11px] text-muted-foreground/70 italic">
                  Aucun aperçu disponible.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <DocsLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        taskId={taskId}
        onLinked={() => { setLinkDialogOpen(false); refresh() }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Link dialog : coller URL ou ID d'un Doc existant
// ─────────────────────────────────────────────────────────────────────────────

interface LinkProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  taskId: string
  onLinked: () => void
}

function DocsLinkDialog({ open, onOpenChange, taskId, onLinked }: LinkProps) {
  const { toast } = useToast()
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) { setInput(""); setSaving(false) }
  }, [open])

  const valid = isValidDocsInput(input)

  const handleSubmit = async () => {
    if (!valid) return
    setSaving(true)
    const { data, error } = await supabase.functions.invoke("google-docs-api", {
      body: { action: "link_doc", app_task_id: taskId, input: input.trim() },
    })
    setSaving(false)
    if (error || data?.error) {
      toast({
        title: "Erreur",
        description: data?.error ?? "Impossible de lier ce document.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Document lié à la tâche" })
    onLinked()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={docsIcon} alt="" className="w-5 h-5 object-contain" loading="lazy" width={20} height={20} />
            Lier un Google Doc
          </DialogTitle>
          <DialogDescription>
            Collez l'URL d'un document Google Docs auquel vous avez accès.
            Le titre et un aperçu du contenu seront récupérés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="docs-url" className="text-xs">URL ou ID du document</Label>
            <Input
              id="docs-url"
              autoFocus
              placeholder="https://docs.google.com/document/d/..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && valid) handleSubmit() }}
              className={cn(input && !valid && "border-destructive focus-visible:ring-destructive")}
            />
            {input && !valid && (
              <p className="text-[11px] text-destructive">
                Doit être une URL docs.google.com ou un identifiant valide.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!valid || saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Lier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
