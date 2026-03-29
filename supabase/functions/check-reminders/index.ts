import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Web Push helpers
const OFFSET_MS: Record<string, number> = {
  "3d": 3 * 24 * 60 * 60 * 1000,
  "1d": 1 * 24 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "1h": 1 * 60 * 60 * 1000,
};

const OFFSET_LABELS: Record<string, string> = {
  "3d": "3 jours",
  "1d": "1 jour",
  "8h": "8 heures",
  "1h": "1 heure",
};

// Convert base64url or base64 string to Uint8Array using atob
function b64urlToUint8Array(str: string): Uint8Array {
  // Trim and clean
  const cleaned = str.trim().replace(/\s/g, '');
  // Convert base64url to base64
  let b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  while (b64.length % 4 !== 0) b64 += '=';
  // Use manual decode to avoid atob issues
  const lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  for (let i = 0; i < b64.length; i += 4) {
    const a = lookup.indexOf(b64[i]);
    const b = lookup.indexOf(b64[i + 1]);
    const c = b64[i + 2] === '=' ? 0 : lookup.indexOf(b64[i + 2]);
    const d = b64[i + 3] === '=' ? 0 : lookup.indexOf(b64[i + 3]);
    if (a < 0 || b < 0) {
      throw new Error('Invalid base64 character in VAPID key');
    }
    bytes.push((a << 2) | (b >> 4));
    if (b64[i + 2] !== '=') bytes.push(((b & 15) << 4) | (c >> 2));
    if (b64[i + 3] !== '=') bytes.push(((c & 3) << 6) | d);
  }
  return new Uint8Array(bytes);
}

// base64url encode without padding
function toBase64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Import ECDSA P-256 key for signing
async function importVapidKey(base64urlKey: string): Promise<CryptoKey> {
  const rawKey = b64urlToUint8Array(base64urlKey);
  return await crypto.subtle.importKey(
    "pkcs8",
    buildPkcs8FromRaw(rawKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

// Build PKCS8 DER from raw 32-byte private key
function buildPkcs8FromRaw(rawKey: Uint8Array): Uint8Array {
  // PKCS8 header for EC P-256
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86,
    0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00,
  ]);
  // We need the public key too, but for JWT signing we can skip it
  // Actually, for ECDSA signing in WebCrypto, we need the full PKCS8
  // Let's use a simpler approach with JWK
  const result = new Uint8Array(header.length + rawKey.length);
  result.set(header);
  result.set(rawKey, header.length);
  return result;
}

// Simple JWT creation for VAPID
async function createVapidJwt(
  audience: string,
  subject: string,
  privateKeyB64url: string,
  publicKeyB64url: string
): Promise<string> {
  const rawKey = b64urlToUint8Array(privateKeyB64url);

  // Import as JWK
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyB64url,
    // We need x and y from public key
    x: "",
    y: "",
  };

  // Derive x and y from uncompressed public key (65 bytes: 04 || x || y)
  const pubBytes = b64urlToUint8Array(publicKeyB64url);
  if (pubBytes.length === 65 && pubBytes[0] === 0x04) {
    jwk.x = toBase64url(pubBytes.slice(1, 33));
    jwk.y = toBase64url(pubBytes.slice(33, 65));
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = toBase64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = toBase64url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s
  const sigBytes = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigBytes[0] === 0x30) {
    // DER encoded
    const rLen = sigBytes[3];
    const rStart = 4;
    r = sigBytes.slice(rStart, rStart + rLen);
    const sLen = sigBytes[rStart + rLen + 1];
    const sStart = rStart + rLen + 2;
    s = sigBytes.slice(sStart, sStart + sLen);
    // Pad/trim to 32 bytes
    r = padTo32(r);
    s = padTo32(s);
    const rawSig = new Uint8Array(64);
    rawSig.set(r, 0);
    rawSig.set(s, 32);
    return `${unsignedToken}.${toBase64url(rawSig)}`;
  } else {
    // Already raw
    return `${unsignedToken}.${toBase64url(sigBytes)}`;
  }
}

function padTo32(arr: Uint8Array): Uint8Array {
  if (arr.length === 32) return arr;
  if (arr.length > 32) return arr.slice(arr.length - 32);
  const padded = new Uint8Array(32);
  padded.set(arr, 32 - arr.length);
  return padded;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<boolean> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await createVapidJwt(
      audience,
      "mailto:noreply@euthymia.app",
      vapidPrivateKey,
      vapidPublicKey
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "identity",
        TTL: "86400",
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: payload,
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("Push failed:", response.status, text);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Push error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = "BFl-X7dNVfMkGjlUJCes-O4IbVfdJrxkNJ91375nwCufXggVCNYMOIcw2_rRNEP1Bu3ZYjSz4PlK8cKIr_tsJ4Y";

    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();

    // Fetch all non-triggered reminders
    const { data: reminders, error: rErr } = await supabase
      .from("task_reminders")
      .select("*")
      .is("triggered_at", null);

    if (rErr) {
      console.error("Error fetching reminders:", rErr);
      return new Response(JSON.stringify({ error: rErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get task IDs
    const taskIds = [...new Set(reminders.map((r: any) => r.task_id))];
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("id, title, due_date, start_date, status")
      .in("id", taskIds);

    const tasksMap = new Map((tasksData || []).map((t: any) => [t.id, t]));

    // Get all assignees for these tasks
    const { data: assigneesData } = await supabase
      .from("task_assignees")
      .select("task_id, member_id")
      .in("task_id", taskIds);

    const taskAssignees = new Map<string, string[]>();
    for (const a of assigneesData || []) {
      const list = taskAssignees.get(a.task_id) || [];
      list.push(a.member_id);
      taskAssignees.set(a.task_id, list);
    }

    // Get all push subscriptions
    const { data: allSubs } = await supabase
      .from("push_subscriptions")
      .select("*");

    const subsByMember = new Map<string, any[]>();
    for (const sub of allSubs || []) {
      const list = subsByMember.get(sub.member_id) || [];
      list.push(sub);
      subsByMember.set(sub.member_id, list);
    }

    let sentCount = 0;
    const triggeredIds: string[] = [];

    for (const reminder of reminders) {
      const task = tasksMap.get(reminder.task_id);
      if (!task || task.status === "done") {
        triggeredIds.push(reminder.id);
        continue;
      }

      const refDate =
        reminder.reminder_type === "before_start"
          ? task.start_date
          : task.due_date;

      if (!refDate) continue;

      const target = new Date(refDate);
      const offsetMs = OFFSET_MS[reminder.offset_key] || 0;
      const triggerTime = new Date(target.getTime() - offsetMs);

      if (now >= triggerTime) {
        // Time to fire this reminder
        triggeredIds.push(reminder.id);

        const typeLabel =
          reminder.reminder_type === "before_start" ? "du début" : "de l'échéance";
        const body = `${OFFSET_LABELS[reminder.offset_key] || reminder.offset_key} avant ${typeLabel}`;

        const payloadStr = JSON.stringify({
          title: `📋 ${task.title}`,
          body,
          data: { taskId: task.id },
        });

        // Send to assignees, or all subscribers if no assignees
        const memberIds = taskAssignees.get(task.id) || [];
        const targetSubs: any[] = [];

        if (memberIds.length > 0) {
          for (const mid of memberIds) {
            const subs = subsByMember.get(mid) || [];
            targetSubs.push(...subs);
          }
        } else {
          // Send to all subscribers
          for (const subs of subsByMember.values()) {
            targetSubs.push(...subs);
          }
        }

        for (const sub of targetSubs) {
          const ok = await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payloadStr,
            vapidPublicKey,
            vapidPrivateKey
          );
          if (ok) sentCount++;
        }
      }
    }

    // Mark triggered
    if (triggeredIds.length > 0) {
      await supabase
        .from("task_reminders")
        .update({ triggered_at: now.toISOString() })
        .in("id", triggeredIds);
    }

    // ── Zoom imminent meeting notifications ──
    let zoomSent = 0;
    try {
      const fifteenMinLater = new Date(now.getTime() + 15 * 60 * 1000);
      const { data: upcomingMeetings } = await supabase
        .from("zoom_meetings")
        .select("id, topic, start_time, join_url, user_id")
        .is("notified_at", null)
        .not("start_time", "is", null)
        .gte("start_time", now.toISOString())
        .lte("start_time", fifteenMinLater.toISOString());

      if (upcomingMeetings && upcomingMeetings.length > 0) {
        // Get profiles to map user_id -> team_member_id
        const userIds = [...new Set(upcomingMeetings.map((m: any) => m.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, team_member_id")
          .in("id", userIds);

        const userToMember = new Map<string, string>();
        for (const p of profiles || []) {
          if (p.team_member_id) userToMember.set(p.id, p.team_member_id);
        }

        const notifiedMeetingIds: string[] = [];

        for (const meeting of upcomingMeetings) {
          const memberId = userToMember.get(meeting.user_id);
          if (!memberId) continue;

          const subs = subsByMember.get(memberId) || [];
          if (subs.length === 0) continue;

          const startDate = new Date(meeting.start_time);
          const minsLeft = Math.round((startDate.getTime() - now.getTime()) / 60000);

          const payloadStr = JSON.stringify({
            title: `🎥 ${meeting.topic}`,
            body: `Réunion Zoom dans ${minsLeft} min`,
            data: { joinUrl: meeting.join_url },
          });

          for (const sub of subs) {
            const ok = await sendWebPush(
              { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
              payloadStr,
              vapidPublicKey,
              vapidPrivateKey
            );
            if (ok) zoomSent++;
          }
          notifiedMeetingIds.push(meeting.id);
        }

        if (notifiedMeetingIds.length > 0) {
          await supabase
            .from("zoom_meetings")
            .update({ notified_at: now.toISOString() })
            .in("id", notifiedMeetingIds);
        }
      }
    } catch (zErr) {
      console.error("Zoom notification error:", zErr);
    }

    return new Response(JSON.stringify({ sent: sentCount + zoomSent, triggered: triggeredIds.length, zoomNotified: zoomSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-reminders error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
