import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { test, expect } from "../playwright-fixture";

const SUPABASE_HOST = "https://jivfyaqpuhutixfjttga.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppdmZ5YXFwdWh1dGl4Zmp0dGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNzkzNDAsImV4cCI6MjA4OTc1NTM0MH0.ttZYEkaS_g2YY6SxPbkaBlxKFWoDc0kVqv-5xIP8XiI";

/** Prédicats RLS appelés par le client : ils doivent rester exécutables. */
const RPCS = ["current_org_id", "get_org_nav_tree", "is_super_admin"] as const;

/**
 * Comptes testés successivement. `userId` à `null` = aucun compte
 * correspondant en base : le cas est explicitement ignoré (skip) plutôt
 * que faussement vert.
 */
const ACCOUNTS: { label: string; email: string; userId: string | null }[] = [
  { label: "Julien", email: "julien.cazabonne@euthymia.fr", userId: "194c5922-b3b1-47ef-8112-b12a4e3601b5" },
  { label: "Cécile", email: "cecile.ducher@euthymia.fr", userId: "4c217005-a0ea-416f-965e-26365fba8014" },
  { label: "Sébastien", email: "sebastien@euthymia.fr", userId: null },
];

type MintedSession = { storageKey: string; sessionJson: string };

/** Ouvre une session applicative pour un utilisateur donné. */
function mintSession(userId: string): MintedSession {
  const out = execFileSync("lovable", ["auth-session", "--json", "--user", userId], {
    encoding: "utf8",
  });
  const meta = JSON.parse(out) as { storage_key: string; session_file: string };
  return {
    storageKey: meta.storage_key,
    sessionJson: readFileSync(meta.session_file, "utf8"),
  };
}

test.describe("Connexions successives : aucun 403 sur les fonctions RLS", () => {
  for (const account of ACCOUNTS) {
    test(`${account.label} — current_org_id, get_org_nav_tree, is_super_admin restent exécutables`, async ({
      page,
      context,
    }) => {
      test.skip(
        !account.userId,
        `Aucun compte d'authentification pour ${account.label} (${account.email})`,
      );

      let session: MintedSession;
      try {
        session = mintSession(account.userId!);
      } catch (e) {
        test.skip(true, `Session indisponible pour ${account.label} : ${String(e)}`);
        return;
      }

      // Chaque test part d'un contexte neuf : on efface tout état résiduel
      // du compte précédent avant de restaurer la nouvelle session.
      await context.clearCookies();
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.evaluate(
        ([key, value]) => localStorage.setItem(key as string, value as string),
        [session.storageKey, session.sessionJson],
      );

      // Surveillance des appels RPC déclenchés par l'application elle-même.
      const observed: { url: string; status: number }[] = [];
      page.on("response", (res) => {
        if (RPCS.some((fn) => res.url().includes(`/rest/v1/rpc/${fn}`))) {
          observed.push({ url: res.url(), status: res.status() });
        }
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(4000);

      // Appels explicites, indépendants du rendu de l'interface.
      const direct = await page.evaluate(
        async ([host, anon, sessionJson, fns]) => {
          const token = JSON.parse(sessionJson as string).access_token as string;
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
        [SUPABASE_HOST, ANON_KEY, session.sessionJson, RPCS as unknown as string[]] as const,
      );

      for (const r of direct) {
        expect(
          [401, 403].includes(r.status),
          `${account.label} — ${r.fn} doit rester exécutable (statut ${r.status}: ${r.body})`,
        ).toBe(false);
        expect(r.body).not.toContain("permission denied");
      }

      const denied = observed.filter((r) => r.status === 401 || r.status === 403);
      expect(
        denied,
        `${account.label} — appels refusés pendant le chargement : ${JSON.stringify(denied)}`,
      ).toEqual([]);
    });
  }
});
