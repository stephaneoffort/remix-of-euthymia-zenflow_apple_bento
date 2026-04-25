import { useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Loader2, CheckCircle2, Circle, Unlink, ArrowLeft } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  useIntegrations,
  INTEGRATION_CONFIG,
  type IntegrationKey,
} from "@/hooks/useIntegrations"

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const CATEGORIES: { label: string; keys: IntegrationKey[] }[] = [
  { label: "Stockage & fichiers", keys: ["google_drive", "dropbox"] },
  { label: "Collaboration",       keys: ["miro", "canva"] },
  { label: "Communication",       keys: ["zoom", "google_meet", "gmail", "brevo"] },
]

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { integrations, loading, toggleEnabled, disconnect, refetch } = useIntegrations()

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate("/settings")
  }

  // Retour après OAuth
  useEffect(() => {
    const provider = searchParams.get("provider")
    const status = searchParams.get("status")
    if (!provider || !status) return

    const label = INTEGRATION_CONFIG[provider as IntegrationKey]?.label ?? provider

    if (status === "connected") {
      toast({ title: `${label} connecté`, description: `Votre compte ${label} a été lié.` })
      refetch()
    } else {
      toast({
        title: `Erreur ${label}`,
        description: `La connexion a échoué (${searchParams.get("reason") ?? "inconnue"}).`,
        variant: "destructive",
      })
    }
    setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleConnect = async (key: IntegrationKey) => {
    const { supabase } = await import("@/integrations/supabase/client")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    window.location.href =
      `${SUPABASE_URL}/functions/v1/integration-oauth/authorize?provider=${key}`
  }

  const handleDisconnect = async (key: IntegrationKey) => {
    await disconnect(key)
    toast({ title: `${INTEGRATION_CONFIG[key].label} déconnecté` })
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Intégrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez vos outils externes pour enrichir votre espace.
        </p>
      </div>

      {CATEGORIES.map(({ label, keys }) => (
        <section key={label} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {keys.map((key) => {
              const config = INTEGRATION_CONFIG[key]
              const status = integrations[key]
              const connected = status?.is_connected ?? false
              const enabled = status?.is_enabled ?? false

              return (
                <Card
                  key={key}
                  className={cn(
                    "transition-all duration-200",
                    connected && "border-emerald-200/60 dark:border-emerald-800/40",
                  )}
                >
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-muted"
                      >
                        <img
                          src={config.icon}
                          alt={config.label}
                          className="w-6 h-6 object-contain"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.description}
                        </p>
                      </div>

                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : connected ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Connecté
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="gap-1.5 text-xs text-muted-foreground"
                        >
                          <Circle className="h-3 w-3" />
                          Non connecté
                        </Badge>
                      )}
                    </div>

                    {/* Footer */}
                    {!loading && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        {connected ? (
                          <>
                            <span className="flex-1 text-xs text-muted-foreground">
                              Activer dans l'application
                            </span>
                            <Switch
                              checked={enabled}
                              onCheckedChange={(v) => toggleEnabled(key, v)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-7 px-2"
                              onClick={() => handleDisconnect(key)}
                            >
                              <Unlink className="h-3 w-3" />
                              Déconnecter
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="flex-1 text-xs text-muted-foreground">
                              Autorisez l'accès pour activer cette intégration.
                            </p>
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs"
                              onClick={() => handleConnect(key)}
                            >
                              Connecter
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
