import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/palettes.css";
import "./styles/theme-ivoire-chaud.css";

// Prevent PWA service worker from interfering in iframe/preview contexts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// Purge de l'ancien cache d'API Supabase créé par les versions précédentes du SW
if (typeof caches !== "undefined") {
  caches.delete("supabase-api-cache").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
