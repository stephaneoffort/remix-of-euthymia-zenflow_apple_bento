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
  name: "create_task",
  title: "Créer une tâche",
  description:
    "Crée une nouvelle tâche dans une liste Euthymia. list_id est requis (utiliser list_tasks pour découvrir des list_id existants).",
  inputSchema: {
    list_id: z.string().describe("ID de la liste dans laquelle créer la tâche"),
    title: z.string().min(1).describe("Titre de la tâche"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    due_date: z.string().optional().describe("Date d'échéance ISO 8601"),
    start_date: z.string().optional().describe("Date de début ISO 8601"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const sb = supabaseForUser(ctx);
    const id = crypto.randomUUID();
    const { data, error } = await sb
      .from("tasks")
      .insert({
        id,
        list_id: input.list_id,
        title: input.title,
        description: input.description ?? "",
        priority: input.priority ?? "medium",
        status: input.status ?? "todo",
        due_date: input.due_date ?? null,
        start_date: input.start_date ?? null,
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tâche créée: ${data.id}` }],
      structuredContent: { task: data },
    };
  },
});
