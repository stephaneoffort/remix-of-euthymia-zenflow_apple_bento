import React, { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown } from "lucide-react";
import DriveAttachments from "@/components/drive/DriveAttachments";
import CanvaAttachments from "@/components/canva/CanvaAttachments";
import { Project } from "@/types";
import { useIntegrations } from "@/hooks/useIntegrations";

const VISIBLE_COUNT = 5;

interface Props {
  projects: Project[];
}

export default function DashboardResourcesSection({ projects }: Props) {
  const { isActive } = useIntegrations();
  const [driveExpanded, setDriveExpanded] = useState(false);
  const [canvaExpanded, setCanvaExpanded] = useState(false);

  if (projects.length === 0) return null;
  if (!isActive('google_drive') && !isActive('canva')) return null;

  const driveVisible = driveExpanded ? projects : projects.slice(0, VISIBLE_COUNT);
  const canvaVisible = canvaExpanded ? projects : projects.slice(0, VISIBLE_COUNT);
  const driveRemaining = projects.length - VISIBLE_COUNT;
  const canvaRemaining = projects.length - VISIBLE_COUNT;

  return (
    <>
      {/* Google Drive */}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="w-full flex items-center justify-between group cursor-pointer mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            📁 Ressources Drive
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </h2>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 md:grid-cols-2">
            {driveVisible.map((project) => (
              <Card key={project.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DriveAttachments entityType="project" entityId={project.id} compact />
                </CardContent>
              </Card>
            ))}
          </div>
          {driveRemaining > 0 && (
            <button
              onClick={() => setDriveExpanded(!driveExpanded)}
              className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
            >
              {driveExpanded ? (
                <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
              ) : (
                <>+{driveRemaining} projet{driveRemaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Canva */}
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="w-full flex items-center justify-between group cursor-pointer mb-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            🎨 Ressources Canva
            <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {projects.length}
            </span>
          </h2>
          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-4 md:grid-cols-2">
            {canvaVisible.map((project) => (
              <Card key={project.id} className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CanvaAttachments entityType="project" entityId={project.id} compact />
                </CardContent>
              </Card>
            ))}
          </div>
          {canvaRemaining > 0 && (
            <button
              onClick={() => setCanvaExpanded(!canvaExpanded)}
              className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
            >
              {canvaExpanded ? (
                <>Réduire <ChevronDown className="w-3.5 h-3.5 rotate-180" /></>
              ) : (
                <>+{canvaRemaining} projet{canvaRemaining > 1 ? "s" : ""} <ChevronDown className="w-3.5 h-3.5" /></>
              )}
            </button>
          )}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
