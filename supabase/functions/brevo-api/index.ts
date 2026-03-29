import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function getApiKey(userId: string): Promise<string> {
  const { data } = await supabase
    .from("brevo_connections")
    .select("api_key")
    .eq("user_id", userId)
    .single();
  if (!data) throw new Error("No Brevo connection for this user");
  return data.api_key;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const userId = claimsData.claims.sub as string;

  try {
    const body = await req.json();
    const { action } = body;

    if (!action || typeof action !== "string") {
      return new Response(JSON.stringify({ error: "Missing action" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const brevoFetch = async (
      method: string,
      path: string,
      apiKey: string,
      payload?: object
    ) => {
      const res = await fetch(`https://api.brevo.com/v3${path}`, {
        method,
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      return res.json();
    };

    // ── SAVE API KEY ────────────────────────────────
    if (action === "save_api_key") {
      const { api_key } = body;
      if (!api_key || typeof api_key !== "string") {
        return new Response(JSON.stringify({ error: "Missing api_key" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const testRes = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": api_key, Accept: "application/json" },
      });
      const account = await testRes.json();

      if (!account.email) {
        return new Response(JSON.stringify({ error: "Clé API invalide" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      await supabase.from("brevo_connections").upsert(
        {
          user_id: userId,
          api_key,
          account_email: account.email,
          account_name: account.companyName ?? account.firstName ?? "",
          plan: account.plan?.[0]?.type ?? "free",
        },
        { onConflict: "user_id" }
      );

      await supabase
        .from("member_integrations")
        .update({
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("integration", "brevo");

      return new Response(
        JSON.stringify({ success: true, account }),
        { headers: corsHeaders }
      );
    }

    // All other actions need an existing API key
    const apiKey = await getApiKey(userId);

    // ── TEST CONNECTION ─────────────────────────────
    if (action === "test") {
      const data = await brevoFetch("GET", "/account", apiKey);
      if (data.email) {
        await supabase
          .from("brevo_connections")
          .update({
            account_email: data.email,
            account_name: data.companyName ?? data.firstName ?? "",
            plan: data.plan?.[0]?.type ?? "free",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
      return new Response(
        JSON.stringify({ connected: !!data.email, account: data }),
        { headers: corsHeaders }
      );
    }

    // ── LIST LISTS ──────────────────────────────────
    if (action === "list_lists") {
      const data = await brevoFetch("GET", "/contacts/lists?limit=50", apiKey);
      return new Response(JSON.stringify(data.lists ?? []), {
        headers: corsHeaders,
      });
    }

    // ── SEARCH CONTACTS ─────────────────────────────
    if (action === "search_contacts") {
      const { query } = body;
      const data = await brevoFetch(
        "GET",
        `/contacts?limit=20&sort=desc`,
        apiKey
      );
      const contacts = (data.contacts ?? []).filter(
        (c: any) =>
          !query ||
          c.email?.toLowerCase().includes(query.toLowerCase()) ||
          c.attributes?.FIRSTNAME?.toLowerCase().includes(
            query.toLowerCase()
          ) ||
          c.attributes?.LASTNAME?.toLowerCase().includes(query.toLowerCase())
      );
      return new Response(JSON.stringify(contacts), { headers: corsHeaders });
    }

    // ── ATTACH CONTACT ──────────────────────────────
    if (action === "attach_contact") {
      const {
        email,
        first_name,
        last_name,
        entity_type,
        entity_id,
        list_ids,
        attributes,
      } = body;

      await brevoFetch("POST", "/contacts", apiKey, {
        email,
        attributes: {
          FIRSTNAME: first_name ?? "",
          LASTNAME: last_name ?? "",
          ...attributes,
        },
        listIds: list_ids ?? [],
        updateEnabled: true,
      });

      const contact = await brevoFetch(
        "GET",
        `/contacts/${encodeURIComponent(email)}`,
        apiKey
      );

      const { data, error } = await supabase
        .from("brevo_contacts")
        .insert({
          user_id: userId,
          entity_type,
          entity_id,
          brevo_contact_id: contact.id ?? null,
          email,
          first_name: first_name ?? null,
          last_name: last_name ?? null,
          list_ids: list_ids ?? [],
          attributes: attributes ?? {},
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // ── LIST ENTITY CONTACTS ────────────────────────
    if (action === "list_contacts") {
      const { entity_type, entity_id } = body;
      const { data } = await supabase
        .from("brevo_contacts")
        .select("*")
        .eq("user_id", userId)
        .eq("entity_type", entity_type)
        .eq("entity_id", entity_id)
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify(data ?? []), {
        headers: corsHeaders,
      });
    }

    // ── DETACH CONTACT ──────────────────────────────
    if (action === "detach_contact") {
      const { contact_id } = body;
      await supabase
        .from("brevo_contacts")
        .delete()
        .eq("id", contact_id)
        .eq("user_id", userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: corsHeaders,
      });
    }

    // ── LIST CAMPAIGNS ──────────────────────────────
    if (action === "list_campaigns") {
      const data = await brevoFetch(
        "GET",
        "/emailCampaigns?limit=20&sort=desc",
        apiKey
      );
      return new Response(JSON.stringify(data.campaigns ?? []), {
        headers: corsHeaders,
      });
    }

    // ── CAMPAIGN STATS ──────────────────────────────
    if (action === "campaign_stats") {
      const { campaign_id } = body;
      const data = await brevoFetch(
        "GET",
        `/emailCampaigns/${campaign_id}`,
        apiKey
      );
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // ── SEND TRANSACTIONAL ──────────────────────────
    if (action === "send_transactional") {
      const { to_email, to_name, subject, html_content, template_id, params } =
        body;
      const payload: any = {
        to: [{ email: to_email, name: to_name ?? "" }],
        sender: { name: "Euthymia", email: "no-reply@euthymia.fr" },
      };
      if (template_id) {
        payload.templateId = template_id;
        payload.params = params ?? {};
      } else {
        payload.subject = subject;
        payload.htmlContent = html_content;
      }
      const data = await brevoFetch("POST", "/smtp/email", apiKey, payload);
      return new Response(JSON.stringify(data), { headers: corsHeaders });
    }

    // ── LIST TEMPLATES ──────────────────────────────
    if (action === "list_templates") {
      const data = await brevoFetch(
        "GET",
        "/smtp/templates?limit=20&templateStatus=true",
        apiKey
      );
      return new Response(JSON.stringify(data.templates ?? []), {
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Brevo API error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
