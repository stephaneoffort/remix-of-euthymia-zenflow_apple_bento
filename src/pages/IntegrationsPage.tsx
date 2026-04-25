import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2, CheckCircle2, Circle, Unlink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { INTEGRATIONS, CATEGORY_LABELS, getIntegrationsByCategory, type IntegrationConfig } from "@/lib/integrations"
import { useIntegration } from "@/hooks/useIntegration"

function IntegrationCard({ config }: { config: IntegrationConfig }) {
  const { status, loading, working, connect, disconnect } = useIntegration(config.provider)

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : null

  return (
    <Card className={cn(
      "transition-all duration-200",
      status.connected && "border-emerald-200/60 dark:border-emerald-800/40",
      !config.enabled && "opacity-60",
    )}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: config.iconBg }}
            dangerouslySetInnerHTML={{ __html: config.iconSvg }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{config.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : !config.enabled ? (
            <Badge variant="outline" className="text-xs text-muted-foreground">Bientôt</Badge>
          ) : status.connected ? (
            <Badge variant="outline" className="gap-1.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-3 w-3" />Connecté
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1.5 text-xs text-muted-foreground">
              <Circle className="h-3 w-3" />Non connecté
            </Badge>
          )}
        </div>

        {!loading && config.enabled && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2">
            {status.connected ? (
              <>
                <div className="flex-1 min-w-0">
                  {status.account_id && <p className="text-xs font-medium truncate">{status.account_id}</p>}
                  {status.updated_at && <p className="text-xs text-muted-foreground">Connecté le {formatDate(status.updated_at)}</p>}
                </div>
                <Button variant="ghost" size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs h-7 px-2"
                  onClick={disconnect} disabled={working}>
                  {working ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                  Déconnecter
                </Button>
              </>
            ) : (
              <>
                <p className="flex-1 text-xs text-muted-foreground">Autorisez l'accès pour activer.</p>
                <Button size="sm" className="h-7 px-3 text-xs" onClick={connect} disabled={working}>
                  {working ? <><Loader2 className="h-3 w-3 animate-spin mr-1.5" />Connexion…</> : "Connecter"}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function IntegrationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { toast } = useToast()

  useEffect(() => {
    const provider = searchParams.get("provider")
    const status   = searchParams.get("status")
    if (!provider || !status) return
    const label = INTEGRATIONS.find(i => i.provider === provider)?.label ?? provider
    if (status === "connected") {
      toast({ title: `${label} connecté`, description: `Votre compte ${label} a été lié avec succès.` })
    } else {
      toast({ title: `Erreur ${label}`, description: `Connexion échouée (${searchParams.get("reason") ?? "inconnue"}).`, variant: "destructive" })
    }
    setSearchParams({}, { replace: true })
  }, []) // eslint-disable-line

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Intégrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Connectez vos outils externes.</p>
      </div>
      {getIntegrationsByCategory().map(([category, items]) => (
        <section key={category} className="space-y-3">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {CATEGORY_LABELS[category]}
          </h2>
          <div className="space-y-2">
            {items.map(config => <IntegrationCard key={config.provider} config={config} />)}
          </div>
        </section>
      ))}
    </div>
  )
}
