import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import DriveAttachments from "@/components/drive/DriveAttachments";
import CanvaAttachments from "@/components/canva/CanvaAttachments";
import { Project } from "@/types";
import { useIntegrations, INTEGRATION_CONFIG } from "@/hooks/useIntegrations";

const MAX_VISIBLE = 5;

interface Props {
  projects: Project[];
}

function DriveCard({ projects }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, MAX_VISIBLE);
  const remaining = projects.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.google_drive.icon} alt="Google Drive" className="w-5 h-5" />
          Ressources Drive
          {projects.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
              {projects.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune ressource Drive</p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}

function CanvaCard({ projects }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? projects : projects.slice(0, MAX_VISIBLE);
  const remaining = projects.length - MAX_VISIBLE;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
          <img src={INTEGRATION_CONFIG.canva.icon} alt="Canva" className="w-5 h-5" />
          Ressources Canva
          {projects.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full ml-auto">
              {projects.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucune ressource Canva</p>
        ) : (
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
        )}
      </CardContent>
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
