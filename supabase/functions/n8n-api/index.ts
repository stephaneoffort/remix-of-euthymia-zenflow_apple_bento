import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Normalise l'URL d'instance n8n : supprime slash final et /api/v1. */
function normalizeInstanceUrl(raw: string): string {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/api\/v1$/i, "");
  return url;
}

async function n8nFetch(
  instanceUrl: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${normalizeInstanceUrl(instanceUrl)}/api/v1${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "X-N8N-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(
    token,
  );
  if (userError || !userData?.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = userData.user.id;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action as string | undefined;
  if (!action) return json({ error: "Missing 'action'" }, 400);

  // Service client pour lire/écrire la connexion (contourne RLS proprement avec user_id explicite)
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    switch (action) {
      // ────────────────────────────────────────────────────────────────────
      // VERIFY : teste une URL/clé sans rien sauvegarder
      // ────────────────────────────────────────────────────────────────────
      case "verify": {
        const { instance_url, api_key } = body;
        if (!instance_url || !api_key) {
          return json({ error: "instance_url et api_key requis" }, 400);
        }
        const res = await n8nFetch(instance_url, api_key, "/workflows?limit=1");
        if (!res.ok) {
          const text = await res.text();
          return json(
            {
              ok: false,
              status: res.status,
              error:
                res.status === 401
                  ? "Clé API invalide"
                  : res.status === 404
                    ? "URL d'instance introuvable"
                    : `Erreur n8n (${res.status})`,
              details: text.slice(0, 300),
            },
            200,
          );
        }
        return json({ ok: true });
      }

      // ────────────────────────────────────────────────────────────────────
      // SAVE : enregistre la connexion + met à jour member_integrations
      // ────────────────────────────────────────────────────────────────────
      case "save": {
        const { instance_url, api_key, display_name } = body;
        if (!instance_url || !api_key) {
          return json({ error: "instance_url et api_key requis" }, 400);
        }

        // Vérifie d'abord
        const verifyRes = await n8nFetch(
          instance_url,
          api_key,
          "/workflows?limit=1",
        );
        if (!verifyRes.ok) {
          return json(
            {
              error:
                verifyRes.status === 401
                  ? "Clé API invalide"
                  : `Connexion impossible (${verifyRes.status})`,
            },
            400,
          );
        }

        const normalizedUrl = normalizeInstanceUrl(instance_url);

        // Upsert manuel (pas de UNIQUE sur user_id)
        const { data: existing } = await db
          .from("n8n_connections")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        const payload = {
          user_id: userId,
          instance_url: normalizedUrl,
          api_key,
          display_name: display_name ?? null,
          is_active: true,
        };

        if (existing?.id) {
          const { error } = await db
            .from("n8n_connections")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await db.from("n8n_connections").insert(payload);
          if (error) throw error;
        }

        // member_integrations
        const nowIso = new Date().toISOString();
        const { data: existingMI } = await db
          .from("member_integrations")
          .select("id")
          .eq("user_id", userId)
          .eq("integration", "n8n")
          .maybeSingle();

        const miPayload = {
          user_id: userId,
          integration: "n8n",
          is_enabled: true,
          is_connected: true,
          enabled_at: nowIso,
          connected_at: nowIso,
          updated_at: nowIso,
        };

        if (existingMI?.id) {
          await db
            .from("member_integrations")
            .update(miPayload)
            .eq("id", existingMI.id);
        } else {
          await db.from("member_integrations").insert(miPayload);
        }

        return json({ ok: true });
      }

      // ────────────────────────────────────────────────────────────────────
      // LIST_WORKFLOWS
      // ────────────────────────────────────────────────────────────────────
      case "list_workflows": {
        const conn = await getConnection(db, userId);
        if (!conn) return json({ error: "n8n non connecté" }, 404);

        const params = new URLSearchParams();
        if (body.active !== undefined) {
          params.set("active", String(!!body.active));
        }
        params.set("limit", String(body.limit ?? 100));

        const res = await n8nFetch(
          conn.instance_url,
          conn.api_key,
          `/workflows?${params.toString()}`,
        );
        const data = await res.json();
        if (!res.ok) {
          return json({ error: "Erreur n8n", details: data }, res.status);
        }
        const workflows = (data?.data ?? []).map((w: any) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          updatedAt: w.updatedAt,
          createdAt: w.createdAt,
          tags: w.tags ?? [],
        }));
        return json({ workflows });
      }

      // ────────────────────────────────────────────────────────────────────
      // TRIGGER_WORKFLOW : exécution manuelle via /workflows/:id/execute
      // (l'API publique n8n expose POST /workflows/{id}/execute en v1+)
      // ────────────────────────────────────────────────────────────────────
      case "trigger_workflow": {
        const { workflow_id, payload } = body;
        if (!workflow_id) return json({ error: "workflow_id requis" }, 400);
        const conn = await getConnection(db, userId);
        if (!conn) return json({ error: "n8n non connecté" }, 404);

        const res = await n8nFetch(
          conn.instance_url,
          conn.api_key,
          `/workflows/${encodeURIComponent(workflow_id)}/execute`,
          {
            method: "POST",
            body: JSON.stringify(payload ?? {}),
          },
        );
        const text = await res.text();
        let data: unknown = text;
        try {
          data = JSON.parse(text);
        } catch { /* keep text */ }

        if (!res.ok) {
          return json(
            {
              error: "Échec d'exécution n8n",
              status: res.status,
              details: data,
            },
            res.status,
          );
        }
        return json({ ok: true, execution: data });
      }

      // ────────────────────────────────────────────────────────────────────
      // GET_CONNECTION : renvoie l'URL et le display_name (PAS la clé API)
      // ────────────────────────────────────────────────────────────────────
      case "get_connection": {
        const conn = await getConnection(db, userId);
        if (!conn) return json({ connected: false });
        return json({
          connected: true,
          instance_url: conn.instance_url,
          display_name: conn.display_name,
        });
      }

      // ────────────────────────────────────────────────────────────────────
      // DISCONNECT
      // ────────────────────────────────────────────────────────────────────
      case "disconnect": {
        await db.from("n8n_connections").delete().eq("user_id", userId);
        await db
          .from("member_integrations")
          .update({
            is_connected: false,
            is_enabled: false,
            connected_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("integration", "n8n");
        return json({ ok: true });
      }

      default:
        return json({ error: `Action inconnue : ${action}` }, 400);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("n8n-api error:", msg);
    return json({ error: msg }, 500);
  }
});

async function getConnection(db: any, userId: string) {
  const { data } = await db
    .from("n8n_connections")
    .select("instance_url, api_key, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  return data as
    | { instance_url: string; api_key: string; display_name: string | null }
    | null;
}
