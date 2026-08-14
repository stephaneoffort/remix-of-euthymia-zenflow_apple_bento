/**
 * Gestion sécurisée du paramètre `state` OAuth.
 *
 * - Le state est un jeton aléatoire à usage unique stocké côté serveur.
 * - Il est créé uniquement après vérification du JWT de l'utilisateur (/authorize).
 * - Il est consommé (supprimé) au retour du fournisseur (/callback), ce qui rend
 *   impossible l'association de tokens à un user_id choisi par un attaquant.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

/** Extrait et valide l'utilisateur appelant (header Authorization ou ?token=). */
export async function getAuthorizedUser(req: Request): Promise<{ id: string } | null> {
  const url = new URL(req.url);
  const token =
    req.headers.get("Authorization")?.replace("Bearer ", "") ??
    url.searchParams.get("token") ??
    "";
  if (!token) return null;
  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

/** Crée un state à usage unique lié à l'utilisateur authentifié. */
export async function createOAuthState(
  userId: string,
  provider: string,
  extra: { code_verifier?: string; redirect_path?: string } = {},
): Promise<string> {
  const state = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { error } = await admin().from("oauth_states").insert({
    state,
    user_id: userId,
    provider,
    code_verifier: extra.code_verifier ?? null,
    redirect_path: extra.redirect_path ?? null,
  });
  if (error) throw new Error(`Impossible de créer le state OAuth: ${error.message}`);
  return state;
}

export interface ConsumedState {
  user_id: string;
  provider: string;
  code_verifier: string | null;
  redirect_path: string | null;
}

/** Valide et consomme le state renvoyé par le fournisseur. Renvoie null si invalide/expiré. */
export async function consumeOAuthState(
  state: string | null,
  provider?: string,
): Promise<ConsumedState | null> {
  if (!state) return null;
  const db = admin();
  const { data } = await db
    .from("oauth_states")
    .select("state, user_id, provider, code_verifier, redirect_path, expires_at")
    .eq("state", state)
    .maybeSingle();

  // Consommation immédiate (usage unique), qu'il soit valide ou non.
  await db.from("oauth_states").delete().eq("state", state);
  // Nettoyage opportuniste des jetons expirés.
  await db.from("oauth_states").delete().lt("expires_at", new Date().toISOString());

  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (provider && data.provider !== provider) return null;

  return {
    user_id: data.user_id,
    provider: data.provider,
    code_verifier: data.code_verifier,
    redirect_path: data.redirect_path,
  };
}
