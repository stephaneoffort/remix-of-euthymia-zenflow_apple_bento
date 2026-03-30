import React, { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown, RefreshCw, FolderOpen, Palette, FileText, Image,
  FileSpreadsheet, File, ExternalLink,
} from "lucide-react";
import DriveAttachments from "@/components/drive/DriveAttachments";
import CanvaAttachments from "@/components/canva/CanvaAttachments";
import { Project } from "@/types";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";
import { supabase } from "@/integrations/supabase/client";

const MAX_VISIBLE = 5;

interface Props {
  projects: Project[];
}

function DriveCard({ projects }: Props) {
  const [projectsWithFiles, setProjectsWithFiles] = useState<Project[]>([]);
  const [fileCounts, setFileCounts] = useState<Record<string, number>>({});
  const [totalFiles, setTotalFiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("drive_attachments")
        .select("entity_id")
        .eq("entity_type", "project");
      const rows = data ?? [];
      const counts: Record<string, number> = {};
      rows.forEach((r: any) => {
        counts[r.entity_id] = (counts[r.entity_id] || 0) + 1;
      });
      const idsWithFiles = new Set(Object.keys(counts));
      setProjectsWithFiles(projects.filter((p) => idsWithFiles.has(p.id)));
      setFileCounts(counts);
      setTotalFiles(rows.length);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [projects]);

  const visible = expanded ? projectsWithFiles : projectsWithFiles.slice(0, MAX_VISIBLE);
  const remaining = projectsWithFiles.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.google_drive.icon} alt="Google Drive" className="w-5 h-5" />
          Ressources Drive
          {totalFiles > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {totalFiles}
            </span>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={fetchData} title="Rafraîchir">
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Fichiers", value: totalFiles, color: "text-primary" },
                { label: "Projets", value: projectsWithFiles.length, color: "text-amber-500" },
                { label: "Récents", value: Math.min(totalFiles, 5), color: "text-emerald-500" },
              ].map((s) => (
                <div key={s.label} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {projectsWithFiles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="p-3 rounded-full bg-muted/50">
                  <FolderOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">Aucune ressource Drive.</p>
                <p className="text-xs text-muted-foreground text-center">
                  Attache des fichiers depuis Google Drive dans tes projets ou tâches.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {visible.map((project) => (
                  <div key={project.id} className="py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                      <Badge variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 ml-auto shrink-0">
                        <FileText className="w-3 h-3" />
                        {fileCounts[project.id] ?? 0}
                      </Badge>
                    </div>
                    <DriveAttachments entityType="project" entityId={project.id} compact />
                  </div>
                ))}
                {remaining > 0 && (
                  <button onClick={() => setExpanded(!expanded)}
                    className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5">
                    {expanded
                      ? <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                      : <>+{remaining} projet{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CanvaCard({ projects }: Props) {
  const [projectsWithDesigns, setProjectsWithDesigns] = useState<Project[]>([]);
  const [designCounts, setDesignCounts] = useState<Record<string, number>>({});
  const [totalDesigns, setTotalDesigns] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("canva_attachments")
        .select("entity_id")
        .eq("entity_type", "project");
      const rows = data ?? [];
      const counts: Record<string, number> = {};
      rows.forEach((r: any) => {
        counts[r.entity_id] = (counts[r.entity_id] || 0) + 1;
      });
      const idsWithDesigns = new Set(Object.keys(counts));
      setProjectsWithDesigns(projects.filter((p) => idsWithDesigns.has(p.id)));
      setDesignCounts(counts);
      setTotalDesigns(rows.length);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [projects]);

  const visible = expanded ? projectsWithDesigns : projectsWithDesigns.slice(0, MAX_VISIBLE);
  const remaining = projectsWithDesigns.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.canva.icon} alt="Canva" className="w-5 h-5" />
          Ressources Canva
          {totalDesigns > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {totalDesigns}
            </span>
          )}
          <div className="ml-auto">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
              onClick={fetchData} title="Rafraîchir">
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Chargement…</p>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Designs", value: totalDesigns, color: "text-primary" },
                { label: "Projets", value: projectsWithDesigns.length, color: "text-amber-500" },
                { label: "Récents", value: Math.min(totalDesigns, 5), color: "text-emerald-500" },
              ].map((s) => (
                <div key={s.label} className="bg-muted/40 rounded-lg px-3 py-2 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {projectsWithDesigns.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <div className="p-3 rounded-full bg-muted/50">
                  <Palette className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground text-center">Aucune ressource Canva.</p>
                <p className="text-xs text-muted-foreground text-center">
                  Attache des designs Canva à tes projets ou tâches.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {visible.map((project) => (
                  <div key={project.id} className="py-2.5 px-2 rounded-md hover:bg-muted/50 transition-colors group">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                      <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                      <Badge variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 gap-0.5 font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20 ml-auto shrink-0">
                        <Image className="w-3 h-3" />
                        {designCounts[project.id] ?? 0}
                      </Badge>
                    </div>
                    <CanvaAttachments entityType="project" entityId={project.id} compact />
                  </div>
                ))}
                {remaining > 0 && (
                  <button onClick={() => setExpanded(!expanded)}
                    className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5">
                    {expanded
                      ? <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                      : <>+{remaining} projet{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardResourcesSection({ projects }: Props) {
  const { isActive } = useIntegrations();

  if (projects.length === 0) return null;
  if (!isActive("google_drive") && !isActive("canva")) return null;

  return (
    <>
      {isActive("google_drive") && <DriveCard projects={projects} />}
      {isActive("canva") && <CanvaCard projects={projects} />}
    </>
  );
}
