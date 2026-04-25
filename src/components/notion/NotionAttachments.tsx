import { useState, useEffect, useCallback } from "react"
import { Loader2, Plus, X, Search, Link as LinkIcon, ExternalLink } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import notionIcon from "@/assets/integrations/notion.png"
import { cn } from "@/lib/utils"

export interface NotionAttachment {
  id: string
  page_id: string
  page_url: string
  page_title: string | null
  page_icon: string | null
  created_at: string
}

interface PickedPage {
  id: string
  url: string
  title: string
  icon: string | null
}

interface Props {
  entityType: "task" | "project" | "space"
  entityId: string
  className?: string
}

function PageIcon({ icon, className }: { icon: string | null; className?: string }) {
  if (!icon) return <img src={notionIcon} alt="" className={cn("w-4 h-4 object-contain", className)} />
  if (icon.startsWith("http")) {
    return <img src={icon} alt="" className={cn("w-4 h-4 object-contain rounded-sm", className)} />
  }
  return <span className={cn("text-base leading-none", className)}>{icon}</span>
}

export default function NotionAttachments({ entityType, entityId, className }: Props) {
  const { toast } = useToast()
  const [attachments, setAttachments] = useState<NotionAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.functions.invoke("notion-api", {
      body: { action: "list_attachments", entity_type: entityType, entity_id: entityId },
    })
    if (!error && data?.attachments) setAttachments(data.attachments)
    setLoading(false)
  }, [entityType, entityId])

  const checkConnection = useCallback(async () => {
    const { data } = await supabase.functions.invoke("notion-api", {
      body: { action: "get_connection" },
    })
    setConnected(!!data?.connected)
  }, [])

  useEffect(() => {
    refresh()
    checkConnection()
  }, [refresh, checkConnection])

  const handleDetach = async (id: string) => {
    const { error } = await supabase.functions.invoke("notion-api", {
      body: { action: "detach", attachment_id: id },
    })
    if (error) {
      toast({ title: "Erreur", description: "Impossible de détacher la page.", variant: "destructive" })
      return
    }
    setAttachments(prev => prev.filter(a => a.id !== id))
  }

  const handlePicked = async (page: PickedPage) => {
    const { error } = await supabase.functions.invoke("notion-api", {
      body: {
        action: "attach",
        entity_type: entityType,
        entity_id: entityId,
        page_id: page.id,
        page_url: page.url,
        page_title: page.title,
        page_icon: page.icon,
      },
    })
    if (error) {
      toast({ title: "Erreur", description: "Impossible d'attacher la page.", variant: "destructive" })
      return
    }
    setPickerOpen(false)
    toast({ title: "Page Notion attachée" })
    refresh()
  }

  if (connected === false) {
    return (
      <div className={cn("text-xs text-muted-foreground flex items-center gap-2", className)}>
        <img src={notionIcon} alt="" className="w-4 h-4 object-contain opacity-60" />
        Connectez Notion dans Réglages → Intégrations pour lier des pages.
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <img src={notionIcon} alt="" className="w-3.5 h-3.5 object-contain" />
          Notion
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setPickerOpen(true)}
          disabled={!connected}
        >
          <Plus className="w-3 h-3" /> Joindre une page
        </Button>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune page Notion attachée.</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(att => (
            <li key={att.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-md border border-border hover:bg-accent/40 transition-colors">
              <PageIcon icon={att.page_icon} />
              <a
                href={att.page_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm hover:underline truncate flex items-center gap-1.5"
              >
                <span className="truncate">{att.page_title || "Page sans titre"}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-muted-foreground" />
              </a>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => handleDetach(att.id)}
                aria-label="Détacher"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <NotionPagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={handlePicked}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker
// ─────────────────────────────────────────────────────────────────────────────

interface PickerProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onPick: (page: PickedPage) => void
}

function NotionPagePicker({ open, onOpenChange, onPick }: PickerProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<"search" | "url">("search")

  // Search
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedPage[]>([])
  const [searching, setSearching] = useState(false)

  // URL
  const [urlInput, setUrlInput] = useState("")
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setUrlInput("")
    }
  }, [open])

  // Recherche debounced
  useEffect(() => {
    if (tab !== "search" || !open) return
    const timeout = setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.functions.invoke("notion-api", {
        body: { action: "search_pages", query },
      })
      if (!error && data?.pages) setResults(data.pages)
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query, tab, open])

  const handleResolveUrl = async () => {
    if (!urlInput.trim()) return
    setResolving(true)
    const { data, error } = await supabase.functions.invoke("notion-api", {
      body: { action: "resolve_url", url: urlInput.trim() },
    })
    setResolving(false)
    if (error || data?.error) {
      toast({
        title: "Page introuvable",
        description: data?.error ?? "Vérifiez l'URL et que la page est partagée avec l'intégration.",
        variant: "destructive",
      })
      return
    }
    onPick(data.page)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={notionIcon} alt="" className="w-5 h-5 object-contain" />
            Attacher une page Notion
          </DialogTitle>
          <DialogDescription>
            Recherchez par titre ou collez directement l'URL d'une page.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={v => setTab(v as "search" | "url")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="search" className="gap-1.5">
              <Search className="w-3.5 h-3.5" /> Rechercher
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> Coller une URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3">
            <Input
              autoFocus
              placeholder="Rechercher dans votre workspace…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="max-h-80 overflow-y-auto space-y-1">
              {searching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {query ? "Aucun résultat." : "Tapez pour rechercher."}
                </p>
              ) : (
                results.map(page => (
                  <button
                    key={page.id}
                    onClick={() => onPick(page)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
                  >
                    <PageIcon icon={page.icon} />
                    <span className="flex-1 min-w-0 text-sm truncate">{page.title}</span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="url" className="space-y-3">
            <Input
              autoFocus
              placeholder="https://www.notion.so/…"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleResolveUrl() }}
            />
            <p className="text-xs text-muted-foreground">
              Astuce : la page doit être partagée avec votre intégration Notion (menu « … » → Connexions).
            </p>
            <Button onClick={handleResolveUrl} disabled={resolving || !urlInput.trim()} className="w-full">
              {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Attacher cette page
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
