import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const APP_URL              = Deno.env.get("APP_URL") ?? "https://euthymia.fr"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Table de connexion par provider (correspond à useIntegrations.ts)
const CONNECTION_TABLE: Record<string, string> = {
  dropbox:       "dropbox_connections",
  miro:          "miro_connections",
  zoom:          "zoom_connections",
  google_drive:  "drive_connections",
  canva:         "canva_connections",
  gmail:         "gmail_connections",
  google_tasks:  "google_tasks_connections",
  google_docs:   "google_docs_connections",
  google_sheets: "google_sheets_connections",
  figma:         "figma_connections",
}

// Config OAuth par provider
const PROVIDER_CONFIG: Record<string, {
  authUrl: string
  tokenUrl: string
  scopes: string[]
  extraParams?: Record<string, string>
  accountIdField?: string
}> = {
  dropbox: {
    authUrl:  "https://www.dropbox.com/oauth2/authorize",
    tokenUrl: "https://api.dropboxapi.com/oauth2/token",
    scopes:   [],
    extraParams: { token_access_type: "offline" },
    accountIdField: "account_id",
  },
  miro: {
    authUrl:  "https://miro.com/oauth/authorize",
    tokenUrl: "https://api.miro.com/v1/oauth/token",
    scopes:   ["boards:read", "boards:write"],
  },
  zoom: {
    authUrl:  "https://zoom.us/oauth/authorize",
    tokenUrl: "https://zoom.us/oauth/token",
    scopes:   ["meeting:write", "meeting:read"],
  },
  google_drive: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:   ["https://www.googleapis.com/auth/drive.file"],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  canva: {
    authUrl:  "https://www.canva.com/api/oauth/authorize",
    tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
    scopes:   ["asset:read", "asset:write"],
  },
  gmail: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:   ["https://www.googleapis.com/auth/gmail.modify"],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  google_tasks: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:   [
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "openid",
    ],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  google_docs: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:   [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  google_sheets: {
    authUrl:  "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes:   [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
      "openid",
    ],
    extraParams: { access_type: "offline", prompt: "consent" },
  },
  figma: {
    authUrl:  "https://www.figma.com/oauth",
    tokenUrl: "https://api.figma.com/v1/oauth/token",
    scopes:   ["files:read"],
  },
}

// Mappe le provider vers le préfixe d'env vars (les providers Google partagent les credentials GOOGLE_*)
function envPrefix(provider: string): string {
  if (provider === "gmail" || provider === "google_drive" || provider === "google_tasks" || provider === "google_docs" || provider === "google_sheets") {
    return "GOOGLE"
  }
  return provider.toUpperCase()
}
function clientId(provider: string)     { return Deno.env.get(`${envPrefix(provider)}_CLIENT_ID`) ?? Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`) ?? "" }
function clientSecret(provider: string) { return Deno.env.get(`${envPrefix(provider)}_CLIENT_SECRET`) ?? Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`) ?? "" }
function redirectUri(provider: string)  { return `${SUPABASE_URL}/functions/v1/integration-oauth/callback?provider=${provider}` }

async function getUser(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "") ?? ""
  const { data: { user } } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.getUser(token)
  return user
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })

  const url      = new URL(req.url)
  const path     = url.pathname
  const provider = url.searchParams.get("provider") ?? ""
  const cfg      = PROVIDER_CONFIG[provider]

  // ── /authorize ────────────────────────────────────────────────────────────
  if (path.endsWith("/authorize")) {
    if (!cfg) return new Response(`Provider inconnu : ${provider}`, { status: 400, headers: CORS })

    const user  = await getUser(req)
    if (!user) return new Response("Unauthorized", { status: 401, headers: CORS })

    const state = btoa(JSON.stringify({ provider, user_id: user.id }))

    const authUrl = new URL(cfg.authUrl)
    authUrl.searchParams.set("client_id",     clientId(provider))
    authUrl.searchParams.set("redirect_uri",  redirectUri(provider))
    authUrl.searchParams.set("response_type", "code")
    authUrl.searchParams.set("state",         state)
    if (cfg.scopes.length) authUrl.searchParams.set("scope", cfg.scopes.join(" "))
    for (const [k, v] of Object.entries(cfg.extraParams ?? {})) authUrl.searchParams.set(k, v)

    return Response.redirect(authUrl.toString(), 302)
  }

  // ── /callback ─────────────────────────────────────────────────────────────
  if (path.endsWith("/callback")) {
    const code  = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")

    let resolvedProvider = provider
    let userId = ""
    try {
      const d = JSON.parse(atob(state ?? ""))
      resolvedProvider = d.provider ?? provider
      userId = d.user_id ?? ""
    } catch (_) { /* ignore */ }

    const resolvedCfg     = PROVIDER_CONFIG[resolvedProvider]
    const connectionTable = CONNECTION_TABLE[resolvedProvider]

    if (!resolvedCfg || !connectionTable || error || !code || !userId) {
      return Response.redirect(
        `${APP_URL}/settings/integrations?provider=${resolvedProvider}&status=error&reason=${error ?? "missing"}`,
        302,
      )
    }

    // Échange du code contre les tokens
    const tokenRes = await fetch(resolvedCfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type:    "authorization_code",
        client_id:     clientId(resolvedProvider),
        client_secret: clientSecret(resolvedProvider),
        redirect_uri:  redirectUri(resolvedProvider),
      }),
    })
    const tokens = await tokenRes.json()

    if (!tokenRes.ok) {
      return Response.redirect(
        `${APP_URL}/settings/integrations?provider=${resolvedProvider}&status=error&reason=token`,
        302,
      )
    }

    const accountIdField = resolvedCfg.accountIdField ?? "account_id"
    const accountIdRaw   = tokens[accountIdField] ?? null
    const accountId      = typeof accountIdRaw === "object" && accountIdRaw !== null
      ? JSON.stringify(accountIdRaw)
      : accountIdRaw

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Construit le payload selon les colonnes de la table cible.
    // Toutes les tables *_connections utilisent token_expiry (pas expires_at).
    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null

    const connectionPayload: Record<string, unknown> = {
      user_id:       userId,
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry:  tokenExpiry,
    }
    // dropbox_connections est la seule à exposer account_id
    if (resolvedProvider === "dropbox" && accountId) {
      connectionPayload.account_id = accountId
    }

    // Upsert manuel : pas de contrainte UNIQUE sur user_id dans ces tables.
    const { data: existing } = await db
      .from(connectionTable)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()

    if (existing?.id) {
      await db.from(connectionTable).update(connectionPayload).eq("id", existing.id)
    } else {
      await db.from(connectionTable).insert(connectionPayload)
    }

    // Mettre à jour member_integrations (upsert manuel aussi)
    const nowIso = new Date().toISOString()
    const { data: existingMI } = await db
      .from("member_integrations")
      .select("id")
      .eq("user_id", userId)
      .eq("integration", resolvedProvider)
      .maybeSingle()

    const miPayload = {
      user_id:      userId,
      integration:  resolvedProvider,
      is_enabled:   true,
      is_connected: true,
      enabled_at:   nowIso,
      connected_at: nowIso,
      updated_at:   nowIso,
    }

    if (existingMI?.id) {
      await db.from("member_integrations").update(miPayload).eq("id", existingMI.id)
    } else {
      await db.from("member_integrations").insert(miPayload)
    }

    return Response.redirect(
      `${APP_URL}/settings/integrations?provider=${resolvedProvider}&status=connected`,
      302,
    )
  }

  return new Response("Not found", { status: 404, headers: CORS })
})
