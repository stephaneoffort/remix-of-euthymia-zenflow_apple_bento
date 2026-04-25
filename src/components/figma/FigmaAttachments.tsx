import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, X, ExternalLink, RefreshCw, Search } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import figmaIcon from "@/assets/integrations/figma.png"
import { cn } from "@/lib/utils"

export interface FigmaLink {
  id: string
  file_key: string
  node_id: string | null
  file_name: string | null
  thumbnail_url: string | null
  preview_image_url: string | null
  last_modified: string | null
  created_at: string
}

interface RecentFile {
  file_key: string
  file_name: string | null
  thumbnail_url: string | null
  last_modified: string | null
}

interface Props {
  taskId: string
  className?: string
}

function isValidFigmaInput(input: string): boolean {
  const v = input.trim()
  if (!v) return false
  if (v.includes("figma.com/")) return /\/(file|design|proto)\/[a-zA-Z0-9]+/.test(v)
  return /^[a-zA-Z0-9]{15,}$/.test(v)
}

function buildFigmaUrl(fileKey: string, nodeId: string | null): string {
  const base = `https://www.figma.com/file/${fileKey}`
  if (!nodeId) return base
  return `${base}?node-id=${encodeURIComponent(nodeId.replace(/:/g, "-"))}`
}

export default function FigmaAttachments({ taskId, className }: Props) {
  const { toast } = useToast()
  const [links, setLinks] = useState<FigmaLink[]>([])
  const [loading, setLoading] = useState(true)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke("figma-api", {
      body: { action: "list_links", task_ids: [taskId] },
    })
    if (!error && Array.isArray(data?.links)) {
      setLinks(data.links as FigmaLink[])
    } else {
      setLinks([])
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { refresh() }, [refresh])

  const handleUnlink = async (linkId: string) => {
    const { error } = await supabase.functions.invoke("figma-api", {
      body: { action: "unlink", link_id: linkId },
    })
    if (error) {
      toast({ title: "Erreur", description: "Impossible de retirer le fichier.", variant: "destructive" })
      return
    }
    setLinks(prev => prev.filter(l => l.id !== linkId))
  }

  const handleRefreshPreview = async (linkId: string) => {
    setRefreshingId(linkId)
    const { data, error } = await supabase.functions.invoke("figma-api", {
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
          <img src={figmaIcon} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" width={14} height={14} />
          Figma
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setLinkDialogOpen(true)}
        >
          <Plus className="w-3 h-3" /> Ajouter
        </Button>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucun fichier Figma attaché.</p>
      ) : (
        <ul className="space-y-1.5">
          {links.map(link => (
            <li
              key={link.id}
              className="group rounded-md border border-border hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-2 px-2 py-1.5">
                <img
                  src={figmaIcon}
                  alt=""
                  className="w-4 h-4 object-contain shrink-0"
                  loading="lazy"
                  width={16}
                  height={16}
                />
                <a
                  href={buildFigmaUrl(link.file_key, link.node_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-sm hover:underline truncate flex items-center gap-1.5"
                >
                  <span className="truncate">{link.file_name || "Fichier Figma"}</span>
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
              ) : link.preview_image_url ? (
                <div className="px-2 pb-2">
                  <a
                    href={buildFigmaUrl(link.file_key, link.node_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md overflow-hidden border border-border/50 bg-muted/30"
                  >
                    <img
                      src={link.preview_image_url}
                      alt={link.file_name ?? "Aperçu Figma"}
                      loading="lazy"
                      className="w-full max-h-48 object-contain bg-muted/20"
                    />
                  </a>
                </div>
              ) : (
                <p className="px-2 pb-1.5 text-[11px] text-muted-foreground/70 italic">
                  Aucun aperçu disponible.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <FigmaLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        taskId={taskId}
        onLinked={() => { setLinkDialogOpen(false); refresh() }}
      />
    </div>
  )
}

interface LinkProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  taskId: string
  onLinked: () => void
}

function FigmaLinkDialog({ open, onOpenChange, taskId, onLinked }: LinkProps) {
  const { toast } = useToast()
  const [input, setInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [recents, setRecents] = useState<RecentFile[]>([])
  const [loadingRecents, setLoadingRecents] = useState(false)

  useEffect(() => {
    if (!open) { setInput(""); setSaving(false); return }
    setLoadingRecents(true)
    supabase.functions
      .invoke("figma-api", { body: { action: "recent_files" } })
      .then(({ data }) => {
        if (Array.isArray(data?.files)) setRecents(data.files as RecentFile[])
      })
      .finally(() => setLoadingRecents(false))
  }, [open])

  const valid = isValidFigmaInput(input)

  const submit = async (linkInput: string) => {
    setSaving(true)
    const { data, error } = await supabase.functions.invoke("figma-api", {
      body: { action: "link_file", task_id: taskId, input: linkInput.trim() },
    })
    setSaving(false)
    if (error || data?.error) {
      toast({
        title: "Erreur",
        description: data?.error ?? "Impossible de lier ce fichier.",
        variant: "destructive",
      })
      return
    }
    toast({ title: "Fichier Figma lié à la tâche" })
    onLinked()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={figmaIcon} alt="" className="w-5 h-5 object-contain" loading="lazy" width={20} height={20} />
            Lier un fichier Figma
          </DialogTitle>
          <DialogDescription>
            Collez l'URL d'un fichier ou frame Figma auquel vous avez accès.
            Le titre et un aperçu seront récupérés automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="figma-url" className="text-xs">URL du fichier ou frame</Label>
            <Input
              id="figma-url"
              autoFocus
              placeholder="https://www.figma.com/file/..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && valid) submit(input) }}
              className={cn(input && !valid && "border-destructive focus-visible:ring-destructive")}
            />
            {input && !valid && (
              <p className="text-[11px] text-destructive">
                Doit être une URL figma.com/file (ou /design /proto) ou un identifiant valide.
              </p>
            )}
          </div>

          {recents.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Search className="w-3 h-3" />
                Récents
              </Label>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {recents.map(f => (
                  <li key={f.file_key}>
                    <button
                      type="button"
                      onClick={() => submit(f.file_key)}
                      disabled={saving}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent text-left text-xs"
                    >
                      {f.thumbnail_url ? (
                        <img
                          src={f.thumbnail_url}
                          alt=""
                          className="w-8 h-6 object-cover rounded border border-border/50"
                          loading="lazy"
                        />
                      ) : (
                        <img
                          src={figmaIcon}
                          alt=""
                          className="w-4 h-4 object-contain"
                          loading="lazy"
                          width={16}
                          height={16}
                        />
                      )}
                      <span className="truncate flex-1">{f.file_name || f.file_key}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loadingRecents && (
            <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Chargement des fichiers récents…
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => submit(input)} disabled={!valid || saving}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Lier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
