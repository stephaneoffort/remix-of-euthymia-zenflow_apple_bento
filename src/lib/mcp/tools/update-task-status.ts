import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "update_task_status",
  title: "Mettre à jour le statut d'une tâche",
  description: "Change le statut d'une tâche existante (todo, in_progress, done).",
  inputSchema: {
    task_id: z.string().describe("ID de la tâche"),
    status: z.enum(["todo", "in_progress", "done"]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb.from("tasks").update({ status }).eq("id", task_id).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Statut mis à jour: ${data.status}` }],
      structuredContent: { task: data },
    };
  },
});
