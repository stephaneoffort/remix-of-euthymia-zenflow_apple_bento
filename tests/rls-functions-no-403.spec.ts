import { test, expect } from "../playwright-fixture";

const SUPABASE_HOST = "https://jivfyaqpuhutixfjttga.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdmZ5YXFwdWh1dGl4Zmp0dGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzkzNDAsImV4cCI6MjA4OTc1NTM0MH0.ttZYEkaS_g2YY6SxPbkaBlxKFWoDc0kVqv-5xIP8XiI";

const RPCS = ["current_org_id", "get_org_nav_tree", "is_super_admin"] as const;

const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;

/**
 * Vérifie qu'une fois Stéphane connecté, les prédicats RLS exposés au client
 * (current_org_id, get_org_nav_tree, is_super_admin) restent exécutables :
 * aucun 401/403 « permission denied for function ».
 */
test.describe("Droits d'exécution des fonctions après connexion", () => {
  test.skip(!sessionJson || !storageKey, "Aucune session authentifiée disponible");

  test("aucun 403 sur current_org_id, get_org_nav_tree et is_super_admin", async ({
    page,
    context,
  }) => {
    if (cookiesJson) {
      await context.addCookies(
        JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({
          ...c,
          url: "http://localhost:8080",
        })),
      );
    }

    // Restauration de la session avant toute navigation applicative.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key as string, value as string),
      [storageKey!, sessionJson!],
    );

    // On capture toutes les réponses des RPC surveillés pendant le chargement.
    const observed: { url: string; status: number }[] = [];
    page.on("response", (res) => {
      const url = res.url();
      if (RPCS.some((fn) => url.includes(`/rest/v1/rpc/${fn}`))) {
        observed.push({ url, status: res.status() });
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    // Appels explicites, pour ne pas dépendre du rendu de l'application.
    const direct = await page.evaluate(
      async ([host, anon, session, fns]) => {
        const token = JSON.parse(session as string).access_token as string;
        const out: { fn: string; status: number; body: string }[] = [];
        for (const fn of fns as string[]) {
          const res = await fetch(`${host}/rest/v1/rpc/${fn}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anon as string,
              Authorization: `Bearer ${token}`,
            },
            body: "{}",
          });
          out.push({ fn, status: res.status, body: (await res.text()).slice(0, 200) });
        }
        return out;
      },
      [SUPABASE_HOST, ANON_KEY, sessionJson!, RPCS as unknown as string[]] as const,
    );

    for (const r of direct) {
      expect(
        [401, 403].includes(r.status),
        `${r.fn} doit rester exécutable (statut ${r.status}: ${r.body})`,
      ).toBe(false);
      expect(r.body).not.toContain("permission denied");
    }

    const denied = observed.filter((r) => r.status === 401 || r.status === 403);
    expect(denied, `Appels refusés pendant le chargement : ${JSON.stringify(denied)}`).toEqual([]);
  });
});
