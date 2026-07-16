import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import updateTaskStatusTool from "./tools/update-task-status";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "euthymia-mcp",
  title: "Euthymia ZenFlow",
  version: "0.1.0",
  instructions:
    "Outils pour Euthymia ZenFlow : gestion de projets et tâches. Utilise list_projects et list_tasks pour explorer, create_task pour créer une tâche dans une liste, et update_task_status pour changer le statut d'une tâche.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, listTasksTool, createTaskTool, updateTaskStatusTool],
});
