import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Check, FileWarning, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { runNumericAudit, loadSourceContext, type NumericViolation } from "@/lib/numericAuditScanner";

interface Acceptance {
  id: string;
  file_path: string;
  line_number: number;
  snippet: string;
  reason: string;
  note: string | null;
  accepted_at: string;
}

type ViolationStatus = "open" | "accepted";

interface RowState {
  v: NumericViolation;
  status: ViolationStatus;
  acceptance?: Acceptance;
}

function violationKey(v: { file: string; line: number; snippet: string } | { file_path: string; line_number: number; snippet: string }): string {
  if ("file" in v) return `${v.file}:${v.line}:${v.snippet}`;
  return `${v.file_path}:${v.line_number}:${v.snippet}`;
}

export default function NumericAudit() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(true);
  const [violations, setViolations] = useState<NumericViolation[]>([]);
  const [acceptances, setAcceptances] = useState<Acceptance[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ViolationStatus>("all");
  const [contextCache, setContextCache] = useState<Record<string, Awaited<ReturnType<typeof loadSourceContext>>>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [cleaning, setCleaning] = useState(false);

  /* ─── Admin gate ─── */
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsAdmin(!!data && data.length > 0));
  }, [user]);

  /* ─── Run audit + load acceptances in parallel ─── */
  const refresh = async () => {
    setScanning(true);
    try {
      const [vios, accs] = await Promise.all([
        runNumericAudit(),
        supabase.from("numeric_audit_acceptances").select("*").order("accepted_at", { ascending: false }),
      ]);
      setViolations(vios);
      setAcceptances((accs.data ?? []) as Acceptance[]);
    } catch (e: any) {
      toast.error("Erreur d'analyse : " + (e?.message ?? e));
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  /* ─── Merge violations + acceptances into rows ─── */
  const rows: RowState[] = useMemo(() => {
    const accMap = new Map<string, Acceptance>();
    acceptances.forEach(a => accMap.set(violationKey(a), a));

    const liveKeys = new Set<string>();
    const live: RowState[] = violations.map(v => {
      const key = violationKey(v);
      liveKeys.add(key);
      const acceptance = accMap.get(key);
      return { v, status: acceptance ? "accepted" : "open", acceptance };
    });

    // Stale acceptances (their violation no longer exists in source)
    const stale: RowState[] = acceptances
      .filter(a => !liveKeys.has(violationKey(a)))
      .map(a => ({
        v: { file: a.file_path, line: a.line_number, snippet: a.snippet, reason: a.reason },
        status: "accepted",
        acceptance: a,
      }));

    return [...live, ...stale];
  }, [violations, acceptances]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.v.file.toLowerCase().includes(q) ||
        r.v.snippet.toLowerCase().includes(q) ||
        r.v.reason.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const openCount = rows.filter(r => r.status === "open").length;
    const acceptedCount = rows.filter(r => r.status === "accepted").length;
    return { openCount, acceptedCount, total: rows.length };
  }, [rows]);

  /* ─── Stale acceptances: violation no longer exists in current scan ─── */
  const staleAcceptances = useMemo(() => {
    const liveKeys = new Set(violations.map(v => violationKey(v)));
    return acceptances.filter(a => !liveKeys.has(violationKey(a)));
  }, [violations, acceptances]);

  /* ─── Lazy-load source context for a row ─── */
  const ensureContext = async (v: NumericViolation) => {
    const key = violationKey(v);
    if (contextCache[key] !== undefined) return;
    const ctx = await loadSourceContext(v.file, v.line, 3);
    setContextCache(prev => ({ ...prev, [key]: ctx }));
  };

  /* ─── Accept / unaccept handlers ─── */
  const accept = async (v: NumericViolation) => {
    if (!user) return;
    const key = violationKey(v);
    setBusyKey(key);
    const { data, error } = await supabase
      .from("numeric_audit_acceptances")
      .insert({
        file_path: v.file,
        line_number: v.line,
        snippet: v.snippet,
        reason: v.reason,
        note: noteDraft[key]?.trim() || null,
        accepted_by: user.id,
      })
      .select()
      .single();
    setBusyKey(null);
    if (error) {
      toast.error("Échec : " + error.message);
      return;
    }
    setAcceptances(prev => [data as Acceptance, ...prev]);
    setNoteDraft(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
    toast.success("Faux positif accepté");
  };

  const unaccept = async (acceptance: Acceptance) => {
    setBusyKey(acceptance.id);
    const { error } = await supabase
      .from("numeric_audit_acceptances")
      .delete()
      .eq("id", acceptance.id);
    setBusyKey(null);
    if (error) {
      toast.error("Échec : " + error.message);
      return;
    }
    setAcceptances(prev => prev.filter(a => a.id !== acceptance.id));
    toast.success("Acceptation retirée");
  };

  /* ─── Bulk cleanup of stale acceptances ─── */
  const cleanupStale = async () => {
    if (staleAcceptances.length === 0) return;
    setCleaning(true);
    const ids = staleAcceptances.map(a => a.id);
    const { error } = await supabase
      .from("numeric_audit_acceptances")
      .delete()
      .in("id", ids);
    setCleaning(false);
    if (error) {
      toast.error("Échec du nettoyage : " + error.message);
      return;
    }
    setAcceptances(prev => prev.filter(a => !ids.includes(a.id)));
    toast.success(`${ids.length} acceptation(s) obsolète(s) supprimée(s)`);
  };

  /* ─── Loading / access guards ─── */
  if (loading || isAdmin === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  /* ─── Render ─── */
  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border flex items-center gap-3 px-6 bg-card sticky top-0 z-10">
        <button
          onClick={() => navigate("/settings")}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Retour"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h1 className="font-display font-bold text-foreground text-lg">Audit typographique numérique</h1>
        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={scanning || cleaning || staleAcceptances.length === 0}
              >
                <Sparkles className={`w-4 h-4 mr-1.5 ${cleaning ? "animate-pulse" : ""}`} />
                Nettoyer obsolètes
                {staleAcceptances.length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    <span data-numeric className="font-numeric tabular-nums text-xs">
                      {staleAcceptances.length}
                    </span>
                  </Badge>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-popover text-popover-foreground">
              <AlertDialogHeader>
                <AlertDialogTitle>Nettoyer les acceptations obsolètes ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera définitivement{" "}
                  <span data-numeric className="font-numeric tabular-nums font-semibold text-foreground">
                    {staleAcceptances.length}
                  </span>{" "}
                  acceptation(s) dont la violation correspondante n'apparaît plus dans le scan actuel
                  (code modifié, supprimé ou refactoré). Les acceptations encore liées à une violation
                  active ne seront pas touchées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={cleanupStale}>
                  Supprimer les obsolètes
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="outline" size="sm" onClick={refresh} disabled={scanning}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${scanning ? "animate-spin" : ""}`} />
            Re-scanner
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total détecté" value={stats.total} tone="muted" />
          <StatCard label="Violations actives" value={stats.openCount} tone="destructive" />
          <StatCard label="Faux positifs acceptés" value={stats.acceptedCount} tone="success" />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par fichier, snippet ou raison…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 rounded-md bg-muted p-1">
              {(["all", "open", "accepted"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "Tous" : s === "open" ? "Actives" : "Acceptées"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Violation list */}
        {scanning ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileWarning className="w-10 h-10 mx-auto mb-3 opacity-50" />
              {rows.length === 0
                ? "Aucune violation détectée. La conformité numérique est totale 🎉"
                : "Aucun résultat pour ce filtre."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => (
              <ViolationRow
                key={violationKey(row.v) + (row.acceptance?.id ?? "")}
                row={row}
                context={contextCache[violationKey(row.v)] ?? null}
                onExpand={() => ensureContext(row.v)}
                noteDraft={noteDraft[violationKey(row.v)] ?? ""}
                onNoteChange={(val) =>
                  setNoteDraft(prev => ({ ...prev, [violationKey(row.v)]: val }))
                }
                onAccept={() => accept(row.v)}
                onUnaccept={() => row.acceptance && unaccept(row.acceptance)}
                busy={busyKey === violationKey(row.v) || busyKey === row.acceptance?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Stat tile ─── */
function StatCard({ label, value, tone }: { label: string; value: number; tone: "muted" | "destructive" | "success" }) {
  const toneClasses =
    tone === "destructive"
      ? "text-destructive"
      : tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
        <p data-numeric className={`font-numeric tabular-nums text-3xl font-bold mt-1 ${toneClasses}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Single row ─── */
function ViolationRow({
  row,
  context,
  onExpand,
  noteDraft,
  onNoteChange,
  onAccept,
  onUnaccept,
  busy,
}: {
  row: RowState;
  context: Awaited<ReturnType<typeof loadSourceContext>> | null;
  onExpand: () => void;
  noteDraft: string;
  onNoteChange: (val: string) => void;
  onAccept: () => void;
  onUnaccept: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && context === null) onExpand();
  };

  return (
    <Card className={row.status === "accepted" ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {row.status === "accepted" ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                  <Check className="w-3 h-3 mr-1" />
                  Faux positif accepté
                </Badge>
              ) : (
                <Badge variant="destructive">Violation active</Badge>
              )}
              <code className="text-xs font-mono text-muted-foreground truncate">
                {row.v.file}:<span data-numeric className="font-numeric tabular-nums">{row.v.line}</span>
              </code>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">{row.v.reason}</p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {row.status === "accepted" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onUnaccept}
                disabled={busy}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Retirer
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onAccept}
                disabled={busy}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Accepter
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Snippet preview */}
        <button
          onClick={toggle}
          className="w-full text-left rounded-md bg-muted/50 hover:bg-muted transition-colors px-3 py-2 font-mono text-xs text-foreground overflow-x-auto"
        >
          {row.v.snippet}
        </button>

        {/* Source context (lazy) */}
        {open && (
          <div className="rounded-md border border-border overflow-hidden">
            {context === null ? (
              <div className="p-3 text-xs text-muted-foreground">Chargement du contexte…</div>
            ) : context === undefined || context.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">Source introuvable (fichier supprimé ou renommé).</div>
            ) : (
              <pre className="text-xs leading-relaxed font-mono overflow-x-auto">
                {context.map(l => (
                  <div
                    key={l.lineNumber}
                    className={`flex ${l.isTarget ? "bg-amber-500/10" : ""}`}
                  >
                    <span data-numeric className="font-numeric tabular-nums shrink-0 w-12 text-right pr-3 py-0.5 text-muted-foreground border-r border-border bg-muted/30 select-none">
                      {l.lineNumber}
                    </span>
                    <code className="flex-1 px-3 py-0.5 whitespace-pre">{l.content}</code>
                  </div>
                ))}
              </pre>
            )}
          </div>
        )}

        {/* Acceptance note */}
        {row.status === "accepted" && row.acceptance?.note && (
          <p className="text-xs italic text-muted-foreground border-l-2 border-emerald-500/40 pl-3">
            « {row.acceptance.note} »
          </p>
        )}

        {/* Note input (only on open violations) */}
        {row.status === "open" && (
          <Input
            value={noteDraft}
            onChange={e => onNoteChange(e.target.value)}
            placeholder="Note justificative (optionnelle, ex: « regex literal », « icône non numérique »)"
            className="text-xs h-8"
          />
        )}
      </CardContent>
    </Card>
  );
}
