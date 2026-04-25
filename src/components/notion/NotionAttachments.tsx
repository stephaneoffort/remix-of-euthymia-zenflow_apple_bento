import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { Loader2, Plus, X, Search, Link as LinkIcon, ExternalLink, Clock, ChevronDown } from "lucide-react"
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
  last_edited_time?: string
  parent_type?: string | null
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

function highlightMatch(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (!q) return text
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "ig")
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-amber-200/60 dark:bg-amber-500/30 text-foreground rounded px-0.5">{part}</mark>
      : <span key={i}>{part}</span>,
  )
}

function formatRelativeDate(iso?: string): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return "à l'instant"
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
}

const PAGE_SIZE = 20
const DEBOUNCE_MS = 200

function NotionPagePicker({ open, onOpenChange, onPick }: PickerProps) {
  const { toast } = useToast()
  const [tab, setTab] = useState<"search" | "url">("search")

  // Search state
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedPage[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // URL state
  const [urlInput, setUrlInput] = useState("")
  const [resolving, setResolving] = useState(false)

  // Concurrence : on garde le numéro de la dernière requête pour ignorer les anciennes
  const requestIdRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Reset à l'ouverture/fermeture
  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setUrlInput("")
      setNextCursor(null); setHasMore(false); setActiveIndex(0)
    }
  }, [open])

  // Recherche initiale (au changement de query) — debounced + concurrence
  useEffect(() => {
    if (tab !== "search" || !open) return
    const myRequestId = ++requestIdRef.current
    const timeout = setTimeout(async () => {
      setSearching(true)
      const { data, error } = await supabase.functions.invoke("notion-api", {
        body: { action: "search_pages", query, page_size: PAGE_SIZE },
      })
      // Ignore si une requête plus récente est partie entre-temps
      if (myRequestId !== requestIdRef.current) return
      if (!error && data?.pages) {
        setResults(data.pages)
        setNextCursor(data.next_cursor ?? null)
        setHasMore(!!data.has_more)
        setActiveIndex(0)
      } else {
        setResults([])
        setNextCursor(null)
        setHasMore(false)
      }
      setSearching(false)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [query, tab, open])

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const myRequestId = requestIdRef.current
    const { data, error } = await supabase.functions.invoke("notion-api", {
      body: { action: "search_pages", query, page_size: PAGE_SIZE, start_cursor: nextCursor },
    })
    if (myRequestId !== requestIdRef.current) { setLoadingMore(false); return }
    if (!error && data?.pages) {
      setResults(prev => [...prev, ...data.pages])
      setNextCursor(data.next_cursor ?? null)
      setHasMore(!!data.has_more)
    }
    setLoadingMore(false)
  }, [nextCursor, loadingMore, query])

  // Auto-scroll de l'élément actif
  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    if (el) el.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const page = results[activeIndex]
      if (page) onPick(page)
    }
  }

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

  const resultsCountLabel = useMemo(() => {
    if (searching) return "Recherche…"
    if (results.length === 0) return null
    return hasMore ? `${results.length}+ résultats` : `${results.length} résultat${results.length > 1 ? "s" : ""}`
  }, [searching, results.length, hasMore])

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

          <TabsContent value="search" className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <Input
                autoFocus
                placeholder="Rechercher dans votre workspace…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-8 pr-8"
                aria-label="Rechercher une page Notion"
                aria-autocomplete="list"
                aria-controls="notion-results-list"
                aria-activedescendant={results[activeIndex] ? `notion-page-${results[activeIndex].id}` : undefined}
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 h-4">
              <span>{resultsCountLabel}</span>
              {results.length > 0 && (
                <span className="hidden sm:inline">
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑</kbd>
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] ml-0.5">↓</kbd>
                  {" naviguer · "}
                  <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
                  {" sélectionner"}
                </span>
              )}
            </div>

            <div
              ref={listRef}
              id="notion-results-list"
              role="listbox"
              className="max-h-80 overflow-y-auto space-y-0.5 -mx-1 px-1"
            >
              {searching && results.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {query ? "Aucun résultat pour cette recherche." : "Tapez pour rechercher dans votre workspace."}
                </p>
              ) : (
                <>
                  {results.map((page, i) => {
                    const isActive = i === activeIndex
                    const relDate = formatRelativeDate(page.last_edited_time)
                    return (
                      <button
                        key={page.id}
                        id={`notion-page-${page.id}`}
                        ref={el => { itemRefs.current[i] = el }}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => onPick(page)}
                        onMouseEnter={() => setActiveIndex(i)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-left transition-colors",
                          isActive ? "bg-accent" : "hover:bg-accent/50",
                        )}
                      >
                        <PageIcon icon={page.icon} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {highlightMatch(page.title, query)}
                          </p>
                          {relDate && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {relDate}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {hasMore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full mt-1 h-8 text-xs gap-1.5 text-muted-foreground"
                    >
                      {loadingMore
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <ChevronDown className="w-3 h-3" />}
                      Charger plus
                    </Button>
                  )}
                </>
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
