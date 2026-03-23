import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PushSubscriptionResult = {
  ok: boolean;
  reason?: 'unsupported' | 'permission_denied' | 'db_error' | 'unknown_error';
};

const VAPID_PUBLIC_KEY = 'BH60WPWbXxd73SIbLKmFX7MsuDj4p-liploW-VZwNJhu_NtUo78K22FtGxmTzcM-bgjsrKG8_1xfU9aVDGozQF4';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(memberId: string | null) {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported && memberId) {
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, [memberId]);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch {
      setIsSubscribed(false);
    }
    setLoading(false);
  }, []);

  const subscribe = useCallback(async (): Promise<PushSubscriptionResult> => {
    if (!memberId || !isSupported) {
      return { ok: false, reason: 'unsupported' };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { ok: false, reason: 'permission_denied' };
      }

      // Register the push service worker
      const registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer as ArrayBuffer,
      });

      const json = subscription.toJSON();
      
      const { error: dbError } = await (supabase as any).from('push_subscriptions').upsert({
        member_id: memberId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
      }, { onConflict: 'member_id,endpoint' });

      if (dbError) {
        console.error('Push subscription DB error:', dbError);
        // Fallback: try insert directly
        const { error: insertErr } = await (supabase as any).from('push_subscriptions').insert({
          member_id: memberId,
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh || '',
          auth: json.keys?.auth || '',
        });
        if (insertErr) {
          console.error('Push subscription insert fallback error:', insertErr);
          return { ok: false, reason: 'db_error' };
        }
      }

      setIsSubscribed(true);
      return { ok: true };
    } catch (e) {
      console.error('Push subscription error:', e);
      return { ok: false, reason: 'unknown_error' };
    }
  }, [memberId, isSupported]);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await (supabase as any).from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
      setIsSubscribed(false);
      return true;
    } catch (e) {
      console.error('Push unsubscribe error:', e);
      return false;
    }
  }, []);

  return { isSupported, isSubscribed, loading, subscribe, unsubscribe };
}
