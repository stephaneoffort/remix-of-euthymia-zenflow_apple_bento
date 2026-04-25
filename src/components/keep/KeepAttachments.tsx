import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, X, ExternalLink, Lightbulb } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import keepIcon from "@/assets/integrations/google-keep.png"
import { cn } from "@/lib/utils"

export interface KeepAttachment {
  id: string
  note_url: string
  note_title: string | null
  note_color: string | null
  created_at: string
}

interface Props {
  entityType: "task" | "project" | "space"
  entityId: string
  className?: string
}

// Couleurs officielles Google Keep
const KEEP_COLORS: { name: string; value: string; hex: string }[] = [
  { name: "Défaut",    value: "default",  hex: "#FFFFFF" },
  { name: "Rouge",     value: "red",      hex: "#F28B82" },
  { name: "Orange",    value: "orange",   hex: "#FBBC04" },
  { name: "Jaune",     value: "yellow",   hex: "#FFF475" },
  { name: "Vert",      value: "green",    hex: "#CCFF90" },
  { name: "Turquoise", value: "teal",     hex: "#A7FFEB" },
  { name: "Bleu",      value: "blue",     hex: "#CBF0F8" },
  { name: "Bleu nuit", value: "darkblue", hex: "#AECBFA" },
  { name: "Mauve",     value: "purple",   hex: "#D7AEFB" },
  { name: "Rose",      value: "pink",     hex: "#FDCFE8" },
  { name: "Marron",    value: "brown",    hex: "#E6C9A8" },
  { name: "Gris",      value: "gray",     hex: "#E8EAED" },
]

function colorHex(value: string | null | undefined): string {
  if (!value) return "#FBBC04"
  return KEEP_COLORS.find(c => c.value === value)?.hex ?? "#FBBC04"
}

function isValidKeepUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return u.hostname === "keep.google.com" || u.hostname.endsWith(".keep.google.com")
  } catch {
    return false
  }
}

export default function KeepAttachments({ entityType, entityId, className }: Props) {
  const { toast } = useToast()
  const [attachments, setAttachments] = useState<KeepAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from("keep_attachments")
      .select("id, note_url, note_title, note_color, created_at")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false })
    if (!error && data) setAttachments(data as KeepAttachment[])
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { refresh() }, [refresh])

  const handleDetach = async (id: string) => {
    const { error } = await (supabase as any)
      .from("keep_attachments")
      .delete()
      .eq("id", id)
    if (error) {
      toast({ title: "Erreur", description: "Impossible de retirer la note.", variant: "destructive" })
      return
    }
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handleAdded = () => {
    setDialogOpen(false)
    refresh()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <img src={keepIcon} alt="" className="w-3.5 h-3.5 object-contain" loading="lazy" width={14} height={14} />
          Google Keep
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="w-3 h-3" /> Joindre une note
        </Button>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune note Keep attachée.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(att => (
            <li
              key={att.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-accent/40 transition-colors"
            >
              <span
                className="w-4 h-4 rounded-sm border border-border/50 shrink-0 flex items-center justify-center"
                style={{ backgroundColor: colorHex(att.note_color) }}
                aria-hidden
              >
                <Lightbulb className="w-2.5 h-2.5 text-foreground/70" />
              </span>
              <a
                href={att.note_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm hover:underline truncate flex items-center gap-1.5"
              >
                <span className="truncate">{att.note_title || "Note Keep"}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => handleDetach(att.id)}
                aria-label="Retirer"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <KeepAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entityType={entityType}
        entityId={entityId}
        onAdded={handleAdded}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Add dialog
// ─────────────────────────────────────────────────────────────────────────────

interface AddProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  entityType: "task" | "project" | "space"
  entityId: string
  onAdded: () => void
}

function KeepAddDialog({ open, onOpenChange, entityType, entityId, onAdded }: AddProps) {
  const { toast } = useToast()
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [color, setColor] = useState<string>("default")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setUrl(""); setTitle(""); setColor("default"); setSaving(false)
    }
  }, [open])

  const urlOk = url.trim().length === 0 || isValidKeepUrl(url)
  const canSubmit = url.trim().length > 0 && isValidKeepUrl(url) && !saving

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaving(false)
      toast({ title: "Erreur", description: "Vous devez être connecté.", variant: "destructive" })
      return
    }
    const { error } = await (supabase as any).from("keep_attachments").insert({
      user_id: user.id,
      entity_type: entityType,
      entity_id: entityId,
      note_url: url.trim(),
      note_title: title.trim() || null,
      note_color: color === "default" ? null : color,
    })
    setSaving(false)
    if (error) {
      toast({ title: "Erreur", description: "Impossible d'attacher la note.", variant: "destructive" })
      return
    }
    toast({ title: "Note Keep attachée" })
    onAdded()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={keepIcon} alt="" className="w-5 h-5 object-contain" loading="lazy" width={20} height={20} />
            Attacher une note Google Keep
          </DialogTitle>
          <DialogDescription>
            Collez le lien d'une note Keep. Ouvrez Keep, sélectionnez la note,
            puis menu <span className="font-medium">⋮ → Copier le lien</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="keep-url" className="text-xs">URL de la note</Label>
            <Input
              id="keep-url"
              autoFocus
              placeholder="https://keep.google.com/#NOTE/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canSubmit) handleSubmit() }}
              className={cn(!urlOk && "border-destructive focus-visible:ring-destructive")}
            />
            {!urlOk && (
              <p className="text-[11px] text-destructive">
                L'URL doit commencer par https://keep.google.com/
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="keep-title" className="text-xs">
              Titre <span className="text-muted-foreground">(optionnel)</span>
            </Label>
            <Input
              id="keep-title"
              placeholder="Ex. Idées réunion lundi"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Couleur (visuelle)</Label>
            <div className="flex flex-wrap gap-1.5">
              {KEEP_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    color === c.value
                      ? "border-foreground scale-110 shadow-sm"
                      : "border-border/40 hover:border-border",
                  )}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={color === c.value}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            Attacher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
