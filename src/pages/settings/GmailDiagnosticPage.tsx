import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

interface Diagnostic {
  redirect_uri: string;
  scopes: string[];
  restricted_scopes: string[];
  client_id_present: boolean;
  client_id_preview: string | null;
  client_secret_set: boolean;
  app_url: string | null;
  prompt: string;
  access_type: string;
  probe: { status: number; location: string | null; error?: string };
  probe_verdict: string;
  common_403_causes: string[];
  next_steps: Record<string, string>;
}

const DIAG_URL = `https://${
  import.meta.env.VITE_SUPABASE_PROJECT_ID
}.supabase.co/functions/v1/gmail-oauth-diagnostic`;

export default function GmailDiagnosticPage() {
  const [data, setData] = useState<Diagnostic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(DIAG_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Diagnostic;
      setData(json);
    } catch (e: any) {
      setError(e.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  // Heuristique côté client : on ne peut pas déterminer le mode "Testing" vs
  // "In production" depuis l'API. On l'indique clairement à l'utilisateur.
  const verdict = data?.probe_verdict;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/settings/integrations">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="font-display font-semibold text-foreground text-xl">
              Diagnostic OAuth Gmail
            </h1>
            <p className="text-xs text-muted-foreground">
              Pourquoi l'ajout d'un compte Gmail renvoie 403 ?
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto gap-1.5"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>

        {loading && (
          <Card className="p-6 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </Card>
        )}

        {error && (
          <Card className="p-6 border-destructive/40 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Erreur</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{error}</p>
          </Card>
        )}

        {data && (
          <>
            {/* Configuration serveur */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-foreground">
                  Configuration côté serveur
                </h2>
                <Badge variant={data.client_id_present ? "default" : "destructive"}>
                  {data.client_id_present
                    ? "Client OAuth configuré"
                    : "Client OAuth manquant"}
                </Badge>
              </div>

              <div className="space-y-3">
                <Field
                  label="Redirect URI envoyée à Google"
                  value={data.redirect_uri}
                  onCopy={() => copy(data.redirect_uri, "Redirect URI")}
                  important
                />

                <Field
                  label="Client ID (aperçu)"
                  value={data.client_id_preview || "—"}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Client Secret"
                    value={
                      data.client_secret_set ? "Défini ✓" : "Manquant ✗"
                    }
                    valueClass={
                      data.client_secret_set
                        ? "text-emerald-600"
                        : "text-destructive"
                    }
                  />
                  <Field
                    label="APP_URL (redirection retour)"
                    value={data.app_url || "Non défini"}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Access type" value={data.access_type} />
                  <Field label="Prompt" value={data.prompt} />
                </div>
              </div>
            </Card>

            {/* Scopes */}
            <Card className="p-6 space-y-3">
              <h2 className="font-display font-semibold text-foreground">
                Scopes OAuth demandés
              </h2>
              <ul className="space-y-1.5">
                {data.scopes.map((s) => {
                  const isRestricted = data.restricted_scopes.includes(s);
                  return (
                    <li
                      key={s}
                      className="flex items-center gap-2 text-sm font-mono"
                    >
                      {isRestricted ? (
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <span className="break-all">{s}</span>
                      {isRestricted && (
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          Restricted
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                Les scopes <strong>restricted</strong> (gmail.readonly, gmail.send,
                gmail.modify) nécessitent que votre app soit{" "}
                <strong>vérifiée par Google</strong> OU que l'utilisateur soit
                listé comme <strong>Test user</strong> en mode Testing.
              </p>
            </Card>

            {/* Statut OAuth (heuristique) */}
            <Card className="p-6 space-y-3">
              <h2 className="font-display font-semibold text-foreground">
                Statut publication de l'app OAuth
              </h2>
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">
                    Non détectable automatiquement
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Google ne fournit pas d'API publique pour connaître le mode
                  (Testing / In production) de votre écran de consentement OAuth.
                  Vérifiez manuellement dans la console Google Cloud :
                </p>
                <a
                  href="https://console.cloud.google.com/apis/credentials/consent"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs"
                >
                  Ouvrir l'écran de consentement OAuth
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-xs text-muted-foreground">
                Sonde de l'endpoint <code>accounts.google.com</code> :{" "}
                <Badge variant="outline" className="ml-1">
                  HTTP {data.probe.status} · {verdict}
                </Badge>
              </div>
            </Card>

            {/* Causes probables */}
            <Card className="p-6 space-y-3 border-destructive/30 bg-destructive/5">
              <h2 className="font-display font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Causes probables d'un 403
              </h2>
              <ol className="space-y-2 text-sm">
                {data.common_403_causes.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-destructive shrink-0">
                      {i + 1}.
                    </span>
                    <span className="text-foreground">{c}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Étapes correctives */}
            <Card className="p-6 space-y-4">
              <h2 className="font-display font-semibold text-foreground">
                Étapes correctives
              </h2>

              <div className="space-y-3">
                <Step
                  number="1"
                  title="Ajouter la Redirect URI autorisée"
                  body={data.next_steps.add_redirect_uri}
                  copyValue={data.redirect_uri}
                  onCopy={() => copy(data.redirect_uri, "Redirect URI")}
                  link="https://console.cloud.google.com/apis/credentials"
                />
                <Step
                  number="2"
                  title="Ajouter l'email comme Test user (mode Testing)"
                  body={data.next_steps.add_test_user}
                  link="https://console.cloud.google.com/apis/credentials/consent"
                />
                <Step
                  number="3"
                  title="OU publier l'app (mode Production)"
                  body={data.next_steps.publish_app}
                  link="https://console.cloud.google.com/apis/credentials/consent"
                />
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  important,
  valueClass,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  important?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div
        className={`flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-mono break-all ${
          important ? "bg-primary/5 border-primary/30" : "bg-muted/30"
        } ${valueClass || ""}`}
      >
        <span className="flex-1 min-w-0">{value}</span>
        {onCopy && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onCopy}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Step({
  number,
  title,
  body,
  copyValue,
  onCopy,
  link,
}: {
  number: string;
  title: string;
  body: string;
  copyValue?: string;
  onCopy?: () => void;
  link?: string;
}) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
        {number}
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="font-medium text-sm text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground">{body}</p>
        <div className="flex items-center gap-2 pt-1">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Ouvrir Google Cloud Console
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {copyValue && onCopy && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1"
              onClick={onCopy}
            >
              <Copy className="w-3 h-3" />
              Copier
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
