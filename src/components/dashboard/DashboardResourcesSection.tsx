import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('drive_attachments')
          .select('entity_id')
          .eq('entity_type', 'project');
        const idsWithFiles = new Set((data ?? []).map((r: any) => r.entity_id));
        setProjectsWithFiles(projects.filter(p => idsWithFiles.has(p.id)));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [projects]);

  const visible = expanded ? projectsWithFiles : projectsWithFiles.slice(0, MAX_VISIBLE);
  const remaining = projectsWithFiles.length - MAX_VISIBLE;

  if (loading) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.google_drive.icon} alt="Google Drive" className="w-5 h-5" />
          Ressources Drive
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
            {projectsWithFiles.length}
          </span>
        </CardTitle>
      </CardHeader>
      {projectsWithFiles.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground py-2 text-center">Aucune ressource</p>
        </CardContent>
      ) : (
        <CardContent>
          <div className="space-y-1">
            {visible.map((project) => (
              <div key={project.id} className="py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                </div>
                <DriveAttachments entityType="project" entityId={project.id} compact />
              </div>
            ))}
            {remaining > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
              >
                {expanded ? (
                  <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                ) : (
                  <>+{remaining} projet{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function CanvaCard({ projects }: Props) {
  const [projectsWithDesigns, setProjectsWithDesigns] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('canva_attachments')
          .select('entity_id')
          .eq('entity_type', 'project');
        const idsWithDesigns = new Set((data ?? []).map((r: any) => r.entity_id));
        setProjectsWithDesigns(projects.filter(p => idsWithDesigns.has(p.id)));
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [projects]);

  const visible = expanded ? projectsWithDesigns : projectsWithDesigns.slice(0, MAX_VISIBLE);
  const remaining = projectsWithDesigns.length - MAX_VISIBLE;

  if (loading) return null;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.canva.icon} alt="Canva" className="w-5 h-5" />
          Ressources Canva
          <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
            {projectsWithDesigns.length}
          </span>
        </CardTitle>
      </CardHeader>
      {projectsWithDesigns.length === 0 ? (
        <CardContent>
          <p className="text-sm text-muted-foreground py-2 text-center">Aucune ressource</p>
        </CardContent>
      ) : (
        <CardContent>
          <div className="space-y-1">
            {visible.map((project) => (
              <div key={project.id} className="py-2 px-1 rounded-md hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                </div>
                <CanvaAttachments entityType="project" entityId={project.id} compact />
              </div>
            ))}
            {remaining > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
              >
                {expanded ? (
                  <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
                ) : (
                  <>+{remaining} projet{remaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function DashboardResourcesSection({ projects }: Props) {
  const { isActive } = useIntegrations();

  if (projects.length === 0) return null;
  if (!isActive('google_drive') && !isActive('canva')) return null;

  return (
    <>
      {isActive('google_drive') && <DriveCard projects={projects} />}
      {isActive('canva') && <CanvaCard projects={projects} />}
    </>
  );
}
