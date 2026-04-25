import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NOTION_VERSION = "2022-06-28";

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

async function notionFetch(token: string, path: string, init: RequestInit = {}) {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** Extrait l'ID 32-char d'une URL Notion (ou renvoie tel quel si déjà un id). */
function extractPageIdFromUrl(input: string): string | null {
  const cleaned = input.trim();
  // ID brut (avec ou sans tirets)
  const rawId = cleaned.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(rawId)) return formatId(rawId);

  // URL : on cherche les 32 derniers caractères hex
  const match = cleaned.match(/([0-9a-f]{32})/i);
  if (match) return formatId(match[1]);
  return null;
}
function formatId(hex: string): string {
  const h = hex.toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function pageTitleFromObject(p: any): string {
  const props = p?.properties ?? {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop?.type === "title" && Array.isArray(prop.title)) {
      const text = prop.title.map((t: any) => t?.plain_text ?? "").join("").trim();
      if (text) return text;
    }
  }
  // Fallback : child_page / database title
  if (p?.title && Array.isArray(p.title)) {
    const text = p.title.map((t: any) => t?.plain_text ?? "").join("").trim();
    if (text) return text;
  }
  return "Page sans titre";
}

function pageIconFromObject(p: any): string | null {
  const ic = p?.icon;
  if (!ic) return null;
  if (ic.type === "emoji") return ic.emoji ?? null;
  if (ic.type === "external") return ic.external?.url ?? null;
  if (ic.type === "file") return ic.file?.url ?? null;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const action = body.action as string | undefined;
  if (!action) return json({ error: "Missing 'action'" }, 400);

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  async function getConnection() {
    const { data } = await db
      .from("notion_connections")
      .select("access_token, workspace_id, workspace_name, workspace_icon")
      .eq("user_id", userId)
      .maybeSingle();
    return data as
      | { access_token: string; workspace_id: string; workspace_name: string | null; workspace_icon: string | null }
      | null;
  }

  try {
    switch (action) {
      // ──────────────────────────────────────────────────────────────
      // GET_CONNECTION
      // ──────────────────────────────────────────────────────────────
      case "get_connection": {
        const conn = await getConnection();
        if (!conn) return json({ connected: false });
        return json({
          connected: true,
          workspace_name: conn.workspace_name,
          workspace_icon: conn.workspace_icon,
        });
      }

      // ──────────────────────────────────────────────────────────────
      // SEARCH_PAGES : recherche par titre via /v1/search
      // Supporte pagination : page_size + start_cursor → next_cursor / has_more
      // ──────────────────────────────────────────────────────────────
      case "search_pages": {
        const conn = await getConnection();
        if (!conn) return json({ error: "Notion non connecté" }, 404);

        const query = (body.query as string) ?? "";
        const pageSize = Math.min(Math.max(Number(body.page_size) || 20, 1), 50);
        const startCursor = (body.start_cursor as string | undefined) || undefined;

        const searchBody: Record<string, unknown> = {
          query,
          filter: { property: "object", value: "page" },
          page_size: pageSize,
          sort: { direction: "descending", timestamp: "last_edited_time" },
        };
        if (startCursor) searchBody.start_cursor = startCursor;

        const res = await notionFetch(conn.access_token, "/search", {
          method: "POST",
          body: JSON.stringify(searchBody),
        });
        const data = await res.json();
        if (!res.ok) return json({ error: data?.message ?? "Erreur Notion", status: res.status }, res.status);

        const pages = (data.results ?? []).map((p: any) => ({
          id: p.id,
          url: p.url,
          title: pageTitleFromObject(p),
          icon: pageIconFromObject(p),
          last_edited_time: p.last_edited_time,
          parent_type: p.parent?.type ?? null,
        }));
        return json({
          pages,
          next_cursor: data.next_cursor ?? null,
          has_more: !!data.has_more,
        });
        return json({ pages });
      }

      // ──────────────────────────────────────────────────────────────
      // RESOLVE_URL : récupère les métadonnées d'une page via son URL
      // ──────────────────────────────────────────────────────────────
      case "resolve_url": {
        const conn = await getConnection();
        if (!conn) return json({ error: "Notion non connecté" }, 404);

        const inputUrl = body.url as string | undefined;
        if (!inputUrl) return json({ error: "url requis" }, 400);

        const pageId = extractPageIdFromUrl(inputUrl);
        if (!pageId) return json({ error: "URL Notion invalide" }, 400);

        const res = await notionFetch(conn.access_token, `/pages/${pageId}`);
        const data = await res.json();
        if (!res.ok) {
          return json(
            {
              error:
                res.status === 404
                  ? "Page introuvable. Assurez-vous d'avoir partagé la page avec l'intégration."
                  : data?.message ?? "Erreur Notion",
              status: res.status,
            },
            res.status,
          );
        }
        return json({
          page: {
            id: data.id,
            url: data.url,
            title: pageTitleFromObject(data),
            icon: pageIconFromObject(data),
            last_edited_time: data.last_edited_time,
          },
        });
      }

      // ──────────────────────────────────────────────────────────────
      // ATTACH : ajoute une page à une entité
      // ──────────────────────────────────────────────────────────────
      case "attach": {
        const conn = await getConnection();
        if (!conn) return json({ error: "Notion non connecté" }, 404);

        const { entity_type, entity_id, page_id, page_url, page_title, page_icon } = body;
        if (!entity_type || !entity_id || !page_id || !page_url) {
          return json({ error: "entity_type, entity_id, page_id, page_url requis" }, 400);
        }

        // Évite les doublons (même page sur la même entité)
        const { data: existing } = await db
          .from("notion_attachments")
          .select("id")
          .eq("user_id", userId)
          .eq("entity_type", entity_type)
          .eq("entity_id", entity_id)
          .eq("page_id", page_id)
          .maybeSingle();

        if (existing?.id) return json({ ok: true, id: existing.id, duplicate: true });

        const { data, error } = await db
          .from("notion_attachments")
          .insert({
            user_id: userId,
            entity_type,
            entity_id,
            page_id,
            page_url,
            page_title: page_title ?? null,
            page_icon: page_icon ?? null,
          })
          .select("id")
          .single();
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, id: data.id });
      }

      // ──────────────────────────────────────────────────────────────
      // LIST_ATTACHMENTS
      // ──────────────────────────────────────────────────────────────
      case "list_attachments": {
        const { entity_type, entity_id } = body;
        if (!entity_type || !entity_id) return json({ error: "entity_type, entity_id requis" }, 400);

        const { data, error } = await db
          .from("notion_attachments")
          .select("*")
          .eq("user_id", userId)
          .eq("entity_type", entity_type)
          .eq("entity_id", entity_id)
          .order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 500);
        return json({ attachments: data ?? [] });
      }

      // ──────────────────────────────────────────────────────────────
      // DETACH
      // ──────────────────────────────────────────────────────────────
      case "detach": {
        const { attachment_id } = body;
        if (!attachment_id) return json({ error: "attachment_id requis" }, 400);
        const { error } = await db
          .from("notion_attachments")
          .delete()
          .eq("id", attachment_id)
          .eq("user_id", userId);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }

      // ──────────────────────────────────────────────────────────────
      // DISCONNECT
      // ──────────────────────────────────────────────────────────────
      case "disconnect": {
        await db.from("notion_connections").delete().eq("user_id", userId);
        await db
          .from("member_integrations")
          .update({
            is_connected: false,
            is_enabled: false,
            connected_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("integration", "notion");
        return json({ ok: true });
      }

      default:
        return json({ error: `Action inconnue : ${action}` }, 400);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("notion-api error:", msg);
    return json({ error: msg }, 500);
  }
});
