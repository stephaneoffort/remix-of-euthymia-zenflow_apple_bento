import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Vérifie qu'un utilisateur authentifié est bien à l'origine de la requête.
 * Retourne l'identifiant utilisateur, ou une Response 401 à renvoyer telle quelle.
 */
export async function requireUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<{ userId: string; error: null } | { userId: null; error: Response }> {
  const unauthorized = () => ({
    userId: null as null,
    error: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return unauthorized();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) return unauthorized();

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  try {
    const { data, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !data?.user) return unauthorized();
    return { userId: data.user.id, error: null };
  } catch {
    return unauthorized();
  }
}
