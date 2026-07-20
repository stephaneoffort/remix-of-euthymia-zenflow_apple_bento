import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ShieldCheck, Search, X } from "lucide-react";
import { useApp } from "@/context/AppContext";
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
  const { tasks, projects, spaces, teamMembers } = useApp();
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");
  const [action, setAction] = useState<string>("all");
  const [entityType, setEntityType] = useState<string>("all");
  const [taskId, setTaskId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [spaceId, setSpaceId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("audit_logs" as any) as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      setRows((data as AuditLogRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // Lookups
  const taskById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  // team members are linked to auth via profiles; we only match names by user_id best-effort via email lookup omitted.
  const memberByAuthId = useMemo(() => {
    // profiles.id === auth uid, team_member.id !== auth uid. We don't have profile→member mapping in memory here.
    // Provide filter list from teamMembers labels; matching to logs by user_id will remain via metadata-only.
    return new Map<string, string>();
  }, []);

  const uniqueUserIds = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => { if (r.user_id) s.add(r.user_id); });
    return Array.from(s);
  }, [rows]);

  const uniqueEntityTypes = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => s.add(r.entity_type));
    return Array.from(s);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (action !== "all" && r.action !== action) return false;
      if (entityType !== "all" && r.entity_type !== entityType) return false;
      if (userId !== "all" && r.user_id !== userId) return false;
      if (taskId !== "all") {
        if (!(r.entity_type === "task" && r.entity_id === taskId)) return false;
      }
      if (projectId !== "all" || spaceId !== "all") {
        // Only meaningful for task entities: resolve via tasks -> lists -> projects (we have listId on task)
        if (r.entity_type !== "task" || !r.entity_id) return false;
        const t = taskById.get(r.entity_id);
        if (!t) return false;
        // Task has listId; find project from lists via project? Simpler: iterate projects to find one that contains list
        // Fallback: skip project/space filter if we can't resolve
        // We rely on t as any to check for a project association
        const anyT = t as any;
        const pId = anyT.projectId ?? null;
        if (projectId !== "all" && pId !== projectId) return false;
        if (spaceId !== "all") {
          const proj = pId ? projectById.get(pId) : null;
          if (!proj || proj.spaceId !== spaceId) return false;
        }
      }
      if (q) {
        const hay = [
          r.action,
          r.entity_type,
          r.entity_id ?? "",
          r.user_id ?? "",
          JSON.stringify(r.metadata ?? {}),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, action, entityType, userId, taskId, projectId, spaceId, taskById, projectById]);

  const clearFilters = () => {
    setSearch(""); setAction("all"); setEntityType("all");
    setTaskId("all"); setUserId("all"); setSpaceId("all"); setProjectId("all");
  };

  const hasActiveFilters = search || action !== "all" || entityType !== "all"
    || taskId !== "all" || userId !== "all" || spaceId !== "all" || projectId !== "all";

  const projectsInSpace = useMemo(
    () => spaceId === "all" ? projects : projects.filter(p => p.spaceId === spaceId),
    [projects, spaceId],
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
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

        {/* Filters */}
        <div className="rounded-lg border border-border p-4 space-y-3 bg-card">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (action, ID, métadonnées, titre…)"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes actions</SelectItem>
                {Object.entries(ACTION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger><SelectValue placeholder="Type d'entité" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes entités</SelectItem>
                {uniqueEntityTypes.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={spaceId} onValueChange={(v) => { setSpaceId(v); setProjectId("all"); }}>
              <SelectTrigger><SelectValue placeholder="Espace" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous espaces</SelectItem>
                {spaces.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Projet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous projets</SelectItem>
                {projectsInSpace.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger><SelectValue placeholder="Tâche" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Toutes tâches</SelectItem>
                {tasks.slice(0, 200).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue placeholder="Utilisateur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous utilisateurs</SelectItem>
                {uniqueUserIds.map(u => (
                  <SelectItem key={u} value={u}>{u.slice(0, 8)}…</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {filtered.length} événement{filtered.length > 1 ? "s" : ""} · {rows.length} au total
            </p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-7">
                <X className="w-3 h-3" /> Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Aucun événement.</p>
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
                {filtered.map((r) => {
                  const t = r.entity_type === "task" && r.entity_id ? taskById.get(r.entity_id) : null;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("fr-FR")}
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {ACTION_LABELS[r.action] ?? r.action}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {t ? t.title : `${r.entity_type}${r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}`}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate">
                        {r.metadata && Object.keys(r.metadata).length > 0
                          ? JSON.stringify(r.metadata)
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
