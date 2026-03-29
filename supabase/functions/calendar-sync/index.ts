import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// ─── TOKEN REFRESH: GOOGLE ───
async function refreshGoogleToken(account: any): Promise<string> {
  const expiryTime = new Date(account.token_expiry).getTime();
  if (expiryTime > Date.now() + 5 * 60 * 1000) return account.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: account.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);

  const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await supabase.from("calendar_accounts")
    .update({ access_token: data.access_token, token_expiry: newExpiry })
    .eq("id", account.id);
  account.access_token = data.access_token;
  account.token_expiry = newExpiry;
  return data.access_token;
}

// ─── GOOGLE ───
async function googlePull(account: any): Promise<number> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: "true",
    maxResults: "250",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Google pull failed: ${JSON.stringify(data)}`);

  const events = (data.items || []).map((e: any) => ({
    account_id: account.id,
    user_id: account.user_id,
    external_id: e.id,
    provider: "google",
    title: e.summary || "(Sans titre)",
    description: e.description || null,
    location: e.location || null,
    start_time: e.start?.dateTime || e.start?.date,
    end_time: e.end?.dateTime || e.end?.date,
    is_all_day: !e.start?.dateTime,
    status: e.status || "confirmed",
    sync_status: "synced",
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  if (events.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .upsert(events, { onConflict: "account_id,external_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
  return events.length;
}

async function googlePushCreate(account: any, event: any): Promise<string> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const payload = event.is_all_day
    ? { start: { date: event.start_time.split("T")[0] }, end: { date: event.end_time.split("T")[0] } }
    : { start: { dateTime: event.start_time, timeZone: "Europe/Paris" }, end: { dateTime: event.end_time, timeZone: "Europe/Paris" } };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        ...payload,
      }),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Google create failed: ${JSON.stringify(data)}`);
  await supabase.from("calendar_events")
    .update({ external_id: data.id, sync_status: "synced", last_synced_at: new Date().toISOString() })
    .eq("id", event.id);
  return data.id;
}

async function googlePushUpdate(account: any, event: any): Promise<void> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const payload = event.is_all_day
    ? { start: { date: event.start_time.split("T")[0] }, end: { date: event.end_time.split("T")[0] } }
    : { start: { dateTime: event.start_time, timeZone: "Europe/Paris" }, end: { dateTime: event.end_time, timeZone: "Europe/Paris" } };
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${event.external_id}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: event.title,
        description: event.description,
        location: event.location,
        ...payload,
      }),
    },
  );
  if (!res.ok) throw new Error(`Google update failed: ${await res.text()}`);
  await supabase.from("calendar_events")
    .update({ sync_status: "synced", last_synced_at: new Date().toISOString() })
    .eq("id", event.id);
}

async function googlePushDelete(account: any, externalId: string): Promise<void> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${externalId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Google delete failed: ${await res.text()}`);
}

async function googleTest(account: any): Promise<boolean> {
  try {
    const token = await refreshGoogleToken(account);
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1",
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.ok;
  } catch { return false; }
}


// ─── CALDAV (iCloud, Nextcloud, Proton, Fastmail) ───
function parseICalEvents(ical: string): any[] {
  const events: any[] = [];
  const blocks = ical.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split("END:VEVENT")[0];
    const get = (key: string) => {
      const m = block.match(new RegExp(`${key}[^:]*:(.+?)\\r?\\n`, "i"));
      return m ? m[1].trim() : null;
    };
    const uid = get("UID");
    const dtstart = get("DTSTART");
    if (uid && dtstart) {
      events.push({
        uid,
        title: get("SUMMARY") || "(Sans titre)",
        description: get("DESCRIPTION"),
        location: get("LOCATION"),
        start_time: parseICalDate(dtstart),
        end_time: parseICalDate(get("DTEND")),
        is_all_day: !dtstart.includes("T"),
        status: (get("STATUS") || "confirmed").toLowerCase(),
      });
    }
  }
  return events;
}

function parseICalDate(val: string | null): string | null {
  if (!val) return null;
  const clean = val.replace(/[^0-9TZ]/g, "");
  if (clean.length >= 15) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`;
  }
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T00:00:00Z`;
  }
  return null;
}

function buildVEvent(event: any): string {
  const uid = event.external_id || event.id || crypto.randomUUID();
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const fmt = (dt: string, allDay: boolean) =>
    allDay ? dt.split("T")[0].replace(/-/g, "") : dt.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EuthymiaZenFlow//CalendarSync//FR",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART${event.is_all_day ? ";VALUE=DATE" : ""}:${fmt(event.start_time, event.is_all_day)}`,
    `DTEND${event.is_all_day ? ";VALUE=DATE" : ""}:${fmt(event.end_time, event.is_all_day)}`,
    `SUMMARY:${event.title || ""}`,
    event.description ? `DESCRIPTION:${event.description}` : "",
    event.location ? `LOCATION:${event.location}` : "",
    `STATUS:${(event.status || "CONFIRMED").toUpperCase()}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

async function caldavPull(account: any): Promise<number> {
  const now = new Date();
  const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const body = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop><D:getetag/><C:calendar-data/></D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
        <C:time-range start="${fmt(now)}" end="${fmt(future)}"/>
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

  const auth = btoa(`${account.caldav_username}:${account.caldav_password}`);
  const res = await fetch(account.caldav_url, {
    method: "REPORT",
    headers: {
      Authorization: `Basic ${auth}`,
      Depth: "1",
      "Content-Type": "application/xml",
    },
    body,
  });
  const xml = await res.text();
  if (!res.ok && res.status !== 207) throw new Error(`CalDAV pull failed: ${xml.slice(0, 500)}`);

  const parsed = parseICalEvents(xml);
  const events = parsed
    .filter((e) => e.uid && e.start_time)
    .map((e) => ({
      account_id: account.id,
      user_id: account.user_id,
      external_id: e.uid,
      provider: account.provider,
      title: e.title,
      description: e.description,
      location: e.location,
      start_time: e.start_time,
      end_time: e.end_time,
      is_all_day: e.is_all_day ?? false,
      status: e.status || "confirmed",
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (events.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .upsert(events, { onConflict: "account_id,external_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
  return events.length;
}

async function caldavPushCreate(account: any, event: any): Promise<string> {
  const uid = event.external_id || event.id || crypto.randomUUID();
  const auth = btoa(`${account.caldav_username}:${account.caldav_password}`);
  const url = `${account.caldav_url.replace(/\/$/, "")}/${uid}.ics`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    },
    body: buildVEvent({ ...event, external_id: uid }),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204)
    throw new Error(`CalDAV create failed: ${await res.text()}`);
  await supabase.from("calendar_events")
    .update({ external_id: uid, sync_status: "synced", last_synced_at: new Date().toISOString() })
    .eq("id", event.id);
  return uid;
}

async function caldavPushUpdate(account: any, event: any): Promise<void> {
  const uid = event.external_id || event.id;
  const auth = btoa(`${account.caldav_username}:${account.caldav_password}`);
  const url = `${account.caldav_url.replace(/\/$/, "")}/${uid}.ics`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "text/calendar; charset=utf-8",
    },
    body: buildVEvent({ ...event, external_id: uid }),
  });
  if (!res.ok && res.status !== 204)
    throw new Error(`CalDAV update failed: ${await res.text()}`);
  await supabase.from("calendar_events")
    .update({ sync_status: "synced", last_synced_at: new Date().toISOString() })
    .eq("id", event.id);
}

async function caldavPushDelete(account: any, externalId: string): Promise<void> {
  const auth = btoa(`${account.caldav_username}:${account.caldav_password}`);
  const url = `${account.caldav_url.replace(/\/$/, "")}/${externalId}.ics`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!res.ok && res.status !== 204)
    throw new Error(`CalDAV delete failed: ${await res.text()}`);
}

async function caldavTest(account: any): Promise<boolean> {
  try {
    const auth = btoa(`${account.caldav_username}:${account.caldav_password}`);
    const res = await fetch(account.caldav_url, {
      method: "PROPFIND",
      headers: { Authorization: `Basic ${auth}`, Depth: "0" },
    });
    return res.ok || res.status === 207;
  } catch { return false; }
}

// ─── ICS (read-only) ───
async function icsPull(account: any): Promise<number> {
  const res = await fetch(account.ics_url);
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
  const text = await res.text();

  const parsed = parseICalEvents(text);
  const events = parsed
    .filter((e) => e.uid && e.start_time)
    .map((e) => ({
      account_id: account.id,
      user_id: account.user_id,
      external_id: e.uid,
      provider: "ics",
      title: e.title,
      description: e.description,
      location: e.location,
      start_time: e.start_time,
      end_time: e.end_time,
      is_all_day: e.is_all_day ?? false,
      status: e.status || "confirmed",
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

  if (events.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .upsert(events, { onConflict: "account_id,external_id" });
    if (error) throw new Error(`Upsert failed: ${error.message}`);
  }
  return events.length;
}

// ─── MAIN HANDLER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id, direction, event_id, action } = await req.json();
    if (!account_id || !direction) {
      return new Response(
        JSON.stringify({ error: "account_id and direction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: account, error: accErr } = await supabase
      .from("calendar_accounts").select("*").eq("id", account_id).single();
    if (accErr || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = account.provider;
    const isCalDav = ["caldav", "icloud", "nextcloud", "proton", "fastmail"].includes(provider);

    // ─── TEST ───
    if (direction === "test") {
      let connected = false;
      if (provider === "google") connected = await googleTest(account);
      else if (isCalDav) connected = await caldavTest(account);
      else if (isCalDav) connected = await caldavTest(account);
      else if (provider === "ics") {
        try { const r = await fetch(account.ics_url, { method: "HEAD" }); connected = r.ok; }
        catch { connected = false; }
      }
      return new Response(
        JSON.stringify({ connected }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── PULL ───
    if (direction === "pull") {
      let count = 0;
      if (provider === "google") count = await googlePull(account);
      else if (isCalDav) count = await caldavPull(account);
      else if (isCalDav) count = await caldavPull(account);
      else if (provider === "ics") count = await icsPull(account);
      else throw new Error(`Unsupported provider: ${provider}`);

      await supabase.from("calendar_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account_id);

      return new Response(
        JSON.stringify({ success: true, count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── PUSH ───
    if (direction === "push") {
      if (provider === "ics") {
        return new Response(
          JSON.stringify({ error: "ICS provider is read-only" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!event_id || !action) {
        return new Response(
          JSON.stringify({ error: "event_id and action are required for push" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: event, error: evErr } = await supabase
        .from("calendar_events").select("*").eq("id", event_id).single();

      if (action === "delete") {
        const externalId = event?.external_id;
        if (!externalId) throw new Error("No external_id for delete");
        if (provider === "google") await googlePushDelete(account, externalId);
        else if (isCalDav) await caldavPushDelete(account, externalId);
        else if (isCalDav) await caldavPushDelete(account, externalId);
        await supabase.from("calendar_events").delete().eq("id", event_id);
      } else if (action === "create") {
        if (evErr || !event) throw new Error("Event not found");
        if (provider === "google") await googlePushCreate(account, event);
        else if (isCalDav) await caldavPushCreate(account, event);
        else if (isCalDav) await caldavPushCreate(account, event);
      } else if (action === "update") {
        if (evErr || !event) throw new Error("Event not found");
        if (provider === "google") await googlePushUpdate(account, event);
        else if (provider === "outlook") await outlookPushUpdate(account, event);
        else if (isCalDav) await caldavPushUpdate(account, event);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid direction" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
