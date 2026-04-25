import { useState, useEffect } from "react"
import { Loader2, ExternalLink, Eye, EyeOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface N8nConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: () => void
}

export default function N8nConnectDialog({
  open,
  onOpenChange,
  onConnected,
}: N8nConnectDialogProps) {
  const { toast } = useToast()
  const [instanceUrl, setInstanceUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testStatus, setTestStatus] = useState<
    | { ok: true }
    | { ok: false; message: string }
    | null
  >(null)

  // Pré-remplit avec la connexion existante (sans la clé)
  useEffect(() => {
    if (!open) return
    setTestStatus(null)
    ;(async () => {
      const { data, error } = await supabase.functions.invoke("n8n-api", {
        body: { action: "get_connection" },
      })
      if (!error && data?.connected) {
        setInstanceUrl(data.instance_url ?? "")
        setDisplayName(data.display_name ?? "")
      }
    })()
  }, [open])

  const handleTest = async () => {
    if (!instanceUrl.trim() || !apiKey.trim()) {
      toast({
        title: "Champs manquants",
        description: "URL d'instance et clé API requis.",
        variant: "destructive",
      })
      return
    }
    setTesting(true)
    setTestStatus(null)
    try {
      const { data, error } = await supabase.functions.invoke("n8n-api", {
        body: {
          action: "verify",
          instance_url: instanceUrl.trim(),
          api_key: apiKey.trim(),
        },
      })
      if (error) throw error
      if (data?.ok) {
        setTestStatus({ ok: true })
      } else {
        setTestStatus({
          ok: false,
          message: data?.error ?? "Connexion impossible",
        })
      }
    } catch (e: any) {
      setTestStatus({ ok: false, message: e?.message ?? "Erreur réseau" })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!instanceUrl.trim() || !apiKey.trim()) {
      toast({
        title: "Champs manquants",
        description: "URL d'instance et clé API requis.",
        variant: "destructive",
      })
      return
    }
    setSaving(true)
    try {
      const { data, error } = await supabase.functions.invoke("n8n-api", {
        body: {
          action: "save",
          instance_url: instanceUrl.trim(),
          api_key: apiKey.trim(),
          display_name: displayName.trim() || null,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)

      toast({ title: "n8n connecté", description: "Connexion enregistrée." })
      onConnected?.()
      onOpenChange(false)
      // Reset
      setApiKey("")
      setTestStatus(null)
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message ?? "Échec de l'enregistrement",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connecter n8n</DialogTitle>
          <DialogDescription>
            Reliez votre instance n8n (Cloud ou auto-hébergée) avec une clé API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="n8n-url">URL de l'instance</Label>
            <Input
              id="n8n-url"
              placeholder="https://votre-compte.app.n8n.cloud"
              value={instanceUrl}
              onChange={(e) => {
                setInstanceUrl(e.target.value)
                setTestStatus(null)
              }}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Sans <code>/api/v1</code> ni slash final — il sera ajouté automatiquement.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n8n-key">Clé API</Label>
            <div className="relative">
              <Input
                id="n8n-key"
                type={showKey ? "text" : "password"}
                placeholder="n8n_api_..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setTestStatus(null)
                }}
                autoComplete="off"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showKey ? "Masquer" : "Afficher"}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <a
              href="https://docs.n8n.io/api/authentication/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Comment obtenir une clé API ?
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="space-y-2">
            <Label htmlFor="n8n-label">Libellé (optionnel)</Label>
            <Input
              id="n8n-label"
              placeholder="Production, perso…"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {testStatus?.ok && (
            <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <AlertDescription className="text-sm text-emerald-700 dark:text-emerald-400">
                Connexion réussie ✓
              </AlertDescription>
            </Alert>
          )}
          {testStatus && testStatus.ok === false && (
            <Alert variant="destructive">
              <AlertDescription className="text-sm">
                {testStatus.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || saving}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Test…
              </>
            ) : (
              "Tester"
            )}
          </Button>
          <Button onClick={handleSave} disabled={saving || testing}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
