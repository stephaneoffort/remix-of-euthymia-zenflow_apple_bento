import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { AuditLogRow } from "@/lib/auditLog";

const ACTION_LABELS: Record<string, string> = {
  "task.created": "Tâche créée",
  "task.updated": "Tâche modifiée",
  "task.deleted": "Tâche supprimée",
  "task.shared": "Tâche partagée",
  "attachment.downloaded": "Pièce jointe téléchargée",
  "attachment.uploaded": "Pièce jointe ajoutée",
  "attachment.deleted": "Pièce jointe supprimée",
};

export default function AuditLog() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("audit_logs" as any) as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data as AuditLogRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold">Journal d'audit</h1>
          </div>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Retour aux tâches
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground">
          Actions sensibles enregistrées (création, modification, suppression, partage, téléchargement).
          Les 500 dernières entrées sont affichées.
        </p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucune entrée pour l'instant.</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Entité</th>
                  <th className="px-3 py-2 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {ACTION_LABELS[r.action] ?? r.action}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.entity_type}
                      {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate">
                      {r.metadata && Object.keys(r.metadata).length > 0
                        ? JSON.stringify(r.metadata)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
