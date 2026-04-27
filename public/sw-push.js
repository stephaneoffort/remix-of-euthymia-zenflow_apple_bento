// Service worker — gestion des push notifications et des clics

self.addEventListener('push', function (event) {
  let data = { title: 'Euthymia', body: 'Vous avez une notification', data: {} };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    data: { url: '/', ...(data.data || {}) },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        // Cherche une fenêtre déjà ouverte sur le même origin
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            // Navigate la fenêtre existante vers l'URL cible puis la focus
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Aucune fenêtre ouverte — en ouvre une nouvelle
        return clients.openWindow(targetUrl);
      })
  );
});

// Activation immédiate du service worker (utile lors des mises à jour)
self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
