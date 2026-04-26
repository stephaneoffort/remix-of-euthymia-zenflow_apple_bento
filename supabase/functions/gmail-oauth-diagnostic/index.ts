// Diagnostic endpoint: returns OAuth config for the gmail-account-oauth flow
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const REDIRECT_URI =
  "https://jivfyaqpuhutixfjttga.supabase.co/functions/v1/gmail-account-oauth/callback";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Sensitive/restricted scopes per Google: require app verification when not in Testing mode
const RESTRICTED_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const clientSecretSet = !!Deno.env.get("GOOGLE_CLIENT_SECRET");
  const appUrl = Deno.env.get("APP_URL") ?? null;

  // Try to detect publishing status by calling Google's tokeninfo on the
  // client_id project — Google does not expose this directly, so we return
  // raw config and let the UI explain. We DO probe the OAuth authorize
  // endpoint with HEAD to detect "access_denied" type errors at config time.
  let probe: { status: number; location: string | null; error?: string } = {
    status: 0,
    location: null,
  };

  try {
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES.join(" "));
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("state", "diagnostic");

    const res = await fetch(authUrl.toString(), {
      method: "GET",
      redirect: "manual",
    });
    probe = {
      status: res.status,
      location: res.headers.get("location"),
    };
  } catch (e: any) {
    probe = { status: 0, location: null, error: e.message };
  }

  // Interpret probe: if Google returns a redirect to an error page, capture it
  let probeVerdict = "unknown";
  if (probe.location?.includes("/signin/oauth/error")) {
    probeVerdict = "oauth_error_page";
  } else if (probe.location?.includes("ServiceLogin") || probe.status === 302) {
    probeVerdict = "ok_redirects_to_login";
  } else if (probe.status >= 400) {
    probeVerdict = "http_error";
  }

  return new Response(
    JSON.stringify(
      {
        redirect_uri: REDIRECT_URI,
        scopes: SCOPES,
        restricted_scopes: RESTRICTED_SCOPES,
        client_id_present: !!clientId,
        client_id_preview: clientId
          ? `${clientId.slice(0, 12)}…${clientId.slice(-20)}`
          : null,
        client_id_project_suffix: clientId.split("-")[0] || null, // first segment
        client_secret_set: clientSecretSet,
        app_url: appUrl,
        prompt: "select_account consent",
        access_type: "offline",
        probe,
        probe_verdict: probeVerdict,
        common_403_causes: [
          "L'URI de redirection n'est pas listée dans 'Authorized redirect URIs' de votre client OAuth Google.",
          "L'écran de consentement OAuth est en mode 'Testing' et l'adresse Gmail à ajouter n'est pas dans 'Test users'.",
          "Les scopes restreints (gmail.readonly/send/modify) ne sont pas approuvés et l'app n'est pas vérifiée.",
          "Le compte Google utilisé est un Workspace dont l'admin a bloqué les apps tierces non approuvées.",
        ],
        next_steps: {
          add_redirect_uri: `Dans Google Cloud Console → APIs & Services → Credentials → votre client OAuth Web → Authorized redirect URIs, ajoutez exactement: ${REDIRECT_URI}`,
          add_test_user: "OAuth consent screen → Test users → Add users → ajoutez l'email Gmail à connecter.",
          publish_app: "OAuth consent screen → Publishing status → Publish App (puis soumission pour vérification si scopes restreints).",
        },
      },
      null,
      2
    ),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
