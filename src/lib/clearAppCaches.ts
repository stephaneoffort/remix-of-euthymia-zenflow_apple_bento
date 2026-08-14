/**
 * Purge complète des caches du service worker.
 * Appelée à la déconnexion pour éviter qu'un utilisateur reçoive
 * des données mises en cache par le compte précédent.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (e) {
    console.warn("Cache purge failed", e);
  }

  try {
    const registrations = await navigator.serviceWorker?.getRegistrations?.();
    registrations?.forEach((r) => {
      r.active?.postMessage({ type: "CLEAR_CACHES" });
    });
  } catch (e) {
    console.warn("Service worker cache message failed", e);
  }
}
