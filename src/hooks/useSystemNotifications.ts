import { useState, useCallback, useEffect } from 'react';

export type NotifPermission = 'default' | 'granted' | 'denied';

export interface NotifyOptions {
  body: string;
  icon?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

async function showOsNotification(title: string, options: NotifyOptions): Promise<void> {
  const notifOptions: NotificationOptions = {
    body: options.body,
    icon: options.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: options.tag,
    data: { url: options.url || '/', ...options.data },
  };

  // Prefer service worker showNotification — fonctionne mieux en PWA/mobile
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        ...notifOptions,
        // @ts-ignore — vibrate est supporté sur Android
        vibrate: [200, 100, 200],
      });
      return;
    } catch {
      // Fallthrough
    }
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, notifOptions);
  }
}

export function useSystemNotifications() {
  const [permission, setPermission] = useState<NotifPermission>(() =>
    typeof Notification !== 'undefined' ? (Notification.permission as NotifPermission) : 'denied'
  );

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission as NotifPermission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotifPermission> => {
    if (typeof Notification === 'undefined') return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);
    return result as NotifPermission;
  }, []);

  const notify = useCallback(async (title: string, options: NotifyOptions): Promise<void> => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    await showOsNotification(title, options);
  }, []);

  return { permission, requestPermission, notify };
}
