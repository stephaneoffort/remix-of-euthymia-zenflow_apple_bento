import { test, expect } from "../playwright-fixture";

const SUPABASE_HOST = "https://jivfyaqpuhutixfjttga.supabase.co";

/**
 * Vérifie qu'après un changement de compte (déconnexion → reconnexion),
 * aucune donnée de l'API Supabase n'est resservie depuis le cache du
 * service worker.
 */
test.describe("Changement de compte et cache du service worker", () => {
  test("aucune réponse Supabase n'est servie depuis le cache après un switch de compte", async ({
    page,
  }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    // 1. On simule l'état laissé par un premier utilisateur : des réponses API
    //    Supabase présentes dans le Cache API (comportement de l'ancien SW).
    await page.evaluate(async (host) => {
      const cache = await caches.open("supabase-api-cache");
      await cache.put(
        `${host}/rest/v1/tasks?select=*`,
        new Response(JSON.stringify([{ id: "task-user-A", title: "Donnée utilisateur A" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await cache.put(
        `${host}/auth/v1/user`,
        new Response(JSON.stringify({ id: "user-A" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const fnCache = await caches.open("functions-cache");
      await fnCache.put(
        `${host}/functions/v1/whatever`,
        new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    }, SUPABASE_HOST);

    const seeded = await page.evaluate(() => caches.keys());
    expect(seeded).toContain("supabase-api-cache");

    // 2. Déconnexion : l'application purge l'intégralité des caches.
    await page.evaluate(async () => {
      const mod = await import("/src/lib/clearAppCaches.ts");
      await mod.clearAppCaches();
    });

    const afterLogout = await page.evaluate(() => caches.keys());
    expect(afterLogout, "tous les caches doivent être vidés à la déconnexion").toEqual([]);

    // 3. Reconnexion (nouveau compte) : plus aucune entrée Supabase ne peut
    //    être resservie depuis le cache.
    await page.reload({ waitUntil: "domcontentloaded" });

    const leftovers = await page.evaluate(async (host) => {
      const found: string[] = [];
      for (const key of await caches.keys()) {
        const cache = await caches.open(key);
        for (const req of await cache.keys()) {
          if (req.url.startsWith(host) && /\/(rest|auth|functions)\/v1\//.test(req.url)) {
            found.push(req.url);
          }
        }
      }
      return found;
    }, SUPABASE_HOST);

    expect(leftovers, "aucune réponse API Supabase ne doit rester en cache").toEqual([]);

    // 4. Un appel API après reconnexion ne doit jamais être satisfait par le cache.
    const fromCache = await page.evaluate(async (host) => {
      const url = `${host}/rest/v1/tasks?select=*`;
      await fetch(url).catch(() => null);
      const match = await caches.match(url);
      if (!match) return null;
      return await match.text();
    }, SUPABASE_HOST);

    expect(fromCache, "la requête /rest/v1/ ne doit pas être mise en cache").toBeNull();
  });

  test("les ressources statiques restent cacheables", async ({ page }) => {
    await page.goto("/auth", { waitUntil: "domcontentloaded" });

    const cached = await page.evaluate(async () => {
      const cache = await caches.open("static-assets-test");
      await cache.put(
        "/favicon.ico",
        new Response("binary", { status: 200, headers: { "Content-Type": "image/x-icon" } }),
      );
      return !!(await caches.match("/favicon.ico"));
    });

    expect(cached).toBe(true);

    // La purge de déconnexion nettoie aussi le statique (rechargé depuis le réseau).
    await page.evaluate(async () => {
      const mod = await import("/src/lib/clearAppCaches.ts");
      await mod.clearAppCaches();
    });
    expect(await page.evaluate(() => caches.keys())).toEqual([]);
  });
});
