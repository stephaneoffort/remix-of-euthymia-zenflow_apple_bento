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
  name: "list_tasks",
  title: "Lister les tâches",
  description:
    "Liste les tâches Euthymia visibles par l'utilisateur. Filtres optionnels: statut (todo/in_progress/done), priorité (low/medium/high/urgent), list_id, limite (défaut 50).",
  inputSchema: {
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    list_id: z.string().optional().describe("Filtrer par liste"),
    limit: z.number().int().positive().optional().describe("Nombre maximum (défaut 50, max 200)"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, priority, list_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const max = Math.min(limit ?? 50, 200);
    let q = sb
      .from("tasks")
      .select("id, title, description, status, priority, due_date, start_date, list_id, tags, progress")
      .order("updated_at", { ascending: false })
      .limit(max);
    if (status) q = q.eq("status", status);
    if (priority) q = q.eq("priority", priority);
    if (list_id) q = q.eq("list_id", list_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tasks: data ?? [], count: data?.length ?? 0 },
    };
  },
});
