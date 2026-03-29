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

  const events = (data.items || []).map((e: any) => {
    const meetLink = e.conferenceData?.entryPoints
      ?.find((ep: any) => ep.entryPointType === "video")?.uri ?? null;
    return {
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
      meet_link: meetLink,
      conference_id: e.conferenceData?.conferenceId ?? null,
      has_meet: meetLink !== null,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

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
  const payload: any = {
    summary: event.title,
    description: event.description,
    location: event.location,
    ...(event.is_all_day
      ? { start: { date: event.start_time.split("T")[0] }, end: { date: event.end_time.split("T")[0] } }
      : { start: { dateTime: event.start_time, timeZone: "Europe/Paris" }, end: { dateTime: event.end_time, timeZone: "Europe/Paris" } }),
  };

  // Add Google Meet if requested
  if (event.has_meet) {
    payload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const meetParam = event.has_meet ? "?conferenceDataVersion=1" : "";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events${meetParam}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Google create failed: ${JSON.stringify(data)}`);

  const meetLink = data.conferenceData?.entryPoints
    ?.find((e: any) => e.entryPointType === "video")?.uri ?? null;

  await supabase.from("calendar_events")
    .update({
      external_id: data.id,
      sync_status: "synced",
      meet_link: meetLink,
      conference_id: data.conferenceData?.conferenceId ?? null,
      has_meet: meetLink !== null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  return data.id;
}

async function googlePushUpdate(account: any, event: any): Promise<void> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const payload: any = {
    summary: event.title,
    description: event.description,
    location: event.location,
    ...(event.is_all_day
      ? { start: { date: event.start_time.split("T")[0] }, end: { date: event.end_time.split("T")[0] } }
      : { start: { dateTime: event.start_time, timeZone: "Europe/Paris" }, end: { dateTime: event.end_time, timeZone: "Europe/Paris" } }),
  };

  if (event.has_meet && !event.conference_id) {
    payload.conferenceData = {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const meetParam = event.has_meet ? "?conferenceDataVersion=1" : "";
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${event.external_id}${meetParam}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`Google update failed: ${await res.text()}`);

  const data = await res.json();
  const meetLink = data.conferenceData?.entryPoints
    ?.find((e: any) => e.entryPointType === "video")?.uri ?? null;

  await supabase.from("calendar_events")
    .update({
      sync_status: "synced",
      meet_link: meetLink,
      conference_id: data.conferenceData?.conferenceId ?? null,
      has_meet: meetLink !== null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", event.id);
}

async function googlePushDelete(account: any, externalId: string): Promise<void> {
  const token = await refreshGoogleToken(account);
  const calId = encodeURIComponent(account.calendar_id || "primary");
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${externalId}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 410) throw new Error(`Google delete failed: ${await res.text()}`);
  if (res.status === 410) await res.text(); // consume body — event already deleted, treat as success
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
  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    throw new Error(`CalDAV update failed: ${await res.text()}`);
  }
  if (!res.ok) await res.text(); // consume body for 404/410
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
  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    throw new Error(`CalDAV delete failed: ${await res.text()}`);
  }
  if (!res.ok) await res.text(); // consume body for 404/410 — resource already gone
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

// ─── ZENFLOW TASK SYNC ───
async function getOrCreateZenflowCalendar(token: string, accountId: string): Promise<string> {
  const { data: account } = await supabase
    .from("calendar_accounts").select("zenflow_calendar_id").eq("id", accountId).single();

  if (account?.zenflow_calendar_id) {
    const checkRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(account.zenflow_calendar_id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (checkRes.ok) { await checkRes.text(); return account.zenflow_calendar_id; }
    await checkRes.text();
  }

  const listRes = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const calList = await listRes.json();
  const existing = calList.items?.find((c: any) => c.summary === "ZENFLOW");

  if (existing) {
    await supabase.from("calendar_accounts").update({ zenflow_calendar_id: existing.id } as any).eq("id", accountId);
    return existing.id;
  }

  const createRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: "ZENFLOW",
        description: "Tâches synchronisées depuis Euthymia ZenFlow",
        timeZone: "Europe/Paris",
      }),
    },
  );
  const created = await createRes.json();

  // Set color
  await fetch(
    `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(created.id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ colorId: "9" }),
    },
  ).then(r => r.text());

  await supabase.from("calendar_accounts").update({ zenflow_calendar_id: created.id } as any).eq("id", accountId);
  return created.id;
}

// ── Get target calendar for a user based on sync preferences ──
async function getTargetCalendarId(token: string, userId: string, accountId: string): Promise<string> {
  const { data: prefs } = await supabase
    .from("user_sync_preferences")
    .select("task_calendar_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (prefs?.task_calendar_id) return prefs.task_calendar_id;
  return getOrCreateZenflowCalendar(token, accountId);
}

// ── Check sync preferences for a user ──
async function getSyncPrefs(userId: string) {
  const { data } = await supabase
    .from("user_sync_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return data || { auto_sync_tasks: true, auto_sync_subtasks: true, sync_tasks_without_date: false, task_calendar_id: null };
}

// ── Build Google Calendar event payload ──
function buildEventPayload(task: any) {
  const isSubtask = !!task.parent_task_id;
  const prefix = isSubtask ? "↳ " : "✓ ";
  const statusEmoji: Record<string, string> = { todo: "🔵", in_progress: "🟡", in_review: "🟠", done: "🟢", blocked: "🔴" };
  const emoji = statusEmoji[task.status] ?? "🔵";
  const eventTitle = `${emoji} ${prefix}${task.title}`;
  const startDate = task.due_date ? new Date(task.due_date) : new Date();
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  const description = [
    task.description || "",
    "",
    "── Détails ZenFlow ──",
    `Statut : ${task.status}`,
    `Priorité : ${task.priority}`,
    isSubtask ? "Type : Sous-tâche" : "Type : Tâche",
    `ID : ${task.id}`,
    "",
    "https://euthymia-zenflow-bento.lovable.app",
  ].join("\n");
  const colorId: Record<string, string> = { todo: "9", in_progress: "5", in_review: "6", done: "10", blocked: "11" };
  return {
    summary: eventTitle,
    description,
    start: { dateTime: startDate.toISOString(), timeZone: "Europe/Paris" },
    end: { dateTime: endDate.toISOString(), timeZone: "Europe/Paris" },
    colorId: colorId[task.status] ?? "9",
    source: { title: "Euthymia ZenFlow", url: "https://euthymia-zenflow-bento.lovable.app" },
  };
}

// ── Push a task to a specific user's Google Calendar ──
async function pushTaskForUser(userId: string, taskId: string, action: string) {
  // Find user's active Google account
  const { data: account } = await supabase
    .from("calendar_accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!account) return; // No Google account — skip

  const token = await refreshGoogleToken(account);

  // Task-level calendar override takes priority over user preference
  const { data: taskRow } = await supabase.from("tasks").select("target_calendar_id").eq("id", taskId).single();
  let calendarId: string;
  if (taskRow?.target_calendar_id && taskRow.target_calendar_id !== '__zenflow__') {
    calendarId = taskRow.target_calendar_id;
  } else if (taskRow?.target_calendar_id === '__zenflow__') {
    calendarId = await getOrCreateZenflowCalendar(token, account.id);
  } else {
    calendarId = await getTargetCalendarId(token, userId, account.id);
  }

  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();

  if (action === "delete") {
    if (task?.google_event_id) {
      const res = await fetch(`${baseUrl}/${task.google_event_id}`, { method: "DELETE", headers });
      await res.text();
    }
    await supabase.from("tasks").update({ google_event_id: null } as any).eq("id", taskId);
    return;
  }

  if (!task) throw new Error("Task not found");

  // If task is done, delete from calendar instead of syncing
  if (task.status === "done") {
    if (task.google_event_id) {
      const res = await fetch(`${baseUrl}/${task.google_event_id}`, { method: "DELETE", headers });
      await res.text();
      await supabase.from("tasks").update({ google_event_id: null } as any).eq("id", taskId);
    }
    return;
  }

  // Check sync preferences
  const prefs = await getSyncPrefs(userId);
  const isSubtask = !!task.parent_task_id;
  if (isSubtask && !prefs.auto_sync_subtasks) return;
  if (!isSubtask && !prefs.auto_sync_tasks) return;
  if (!task.due_date && !prefs.sync_tasks_without_date) return;

  const payload = buildEventPayload(task);

  if (action === "create" || (action === "update" && !task.google_event_id)) {
    const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    const created = await res.json();
    if (created.error) throw new Error("Google error: " + created.error.message);
    await supabase.from("tasks").update({ google_event_id: created.id } as any).eq("id", taskId);
  } else if (action === "update" && task.google_event_id) {
    const res = await fetch(`${baseUrl}/${task.google_event_id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
    const updated = await res.json();
    if (updated.error) throw new Error("Google error: " + updated.error.message);
  }
}

// ── Push task to ALL assigned users' calendars ──
async function pushTaskToAssignees(taskId: string, action: string) {
  // Get all assignees for this task (member_id → user_id via profiles)
  const { data: assignees } = await supabase
    .from("task_assignees")
    .select("member_id")
    .eq("task_id", taskId);

  if (!assignees?.length) return [];

  const memberIds = assignees.map((a: any) => a.member_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, team_member_id")
    .in("team_member_id", memberIds);

  const results: any[] = [];
  for (const profile of (profiles || [])) {
    try {
      await pushTaskForUser(profile.id, taskId, action);
      results.push({ user_id: profile.id, status: "synced" });
    } catch (err: any) {
      console.error(`Sync failed for user ${profile.id}:`, err);
      results.push({ user_id: profile.id, status: "error", error: err.message });
    }
  }
  return results;
}

// ── Legacy: push using caller's account directly ──
async function pushTaskToZenflow(account: any, taskId: string, action: string) {
  const token = await refreshGoogleToken(account);
  const calendarId = await getTargetCalendarId(token, account.user_id, account.id);
  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();

  if (action === "delete") {
    if (task?.google_event_id) {
      const res = await fetch(`${baseUrl}/${task.google_event_id}`, { method: "DELETE", headers });
      await res.text();
    }
    await supabase.from("tasks").update({ google_event_id: null } as any).eq("id", taskId);
    return;
  }

  if (!task) throw new Error("Task not found");
  const payload = buildEventPayload(task);

  if (action === "create" || (action === "update" && !task.google_event_id)) {
    const res = await fetch(baseUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    const created = await res.json();
    if (created.error) throw new Error("Google error: " + created.error.message);
    await supabase.from("tasks").update({ google_event_id: created.id } as any).eq("id", taskId);
  } else if (action === "update" && task.google_event_id) {
    const res = await fetch(`${baseUrl}/${task.google_event_id}`, { method: "PUT", headers, body: JSON.stringify(payload) });
    const updated = await res.json();
    if (updated.error) throw new Error("Google error: " + updated.error.message);
  }
}

async function syncPendingTasks(account: any, userId: string): Promise<number> {
  const { data: profile } = await supabase
    .from("profiles").select("team_member_id").eq("id", userId).single();
  const memberId = profile?.team_member_id;
  if (!memberId) return 0;

  const prefs = await getSyncPrefs(userId);
  if (!prefs.auto_sync_tasks) return 0;

  const { data: assignments } = await supabase
    .from("task_assignees").select("task_id").eq("member_id", memberId);
  const assignedTaskIds = (assignments || []).map((a: any) => a.task_id);
  if (!assignedTaskIds.length) return 0;

  let query = supabase.from("tasks").select("*")
    .is("google_event_id", null)
    .neq("status", "done")
    .in("id", assignedTaskIds);

  if (!prefs.sync_tasks_without_date) {
    query = query.not("due_date", "is", null);
  }

  const { data: pendingTasks } = await query;
  if (!pendingTasks?.length) return 0;

  let synced = 0;
  for (const task of pendingTasks) {
    const isSubtask = !!task.parent_task_id;
    if (isSubtask && !prefs.auto_sync_subtasks) continue;
    try {
      await pushTaskToZenflow(account, task.id, "create");
      synced++;
    } catch (err) {
      console.error(`Failed to sync task ${task.id}:`, err);
    }
  }
  return synced;
}

// ─── AUTH HELPER ───
async function authenticateUser(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const token = authHeader.replace("Bearer ", "")
  const { data, error } = await supabaseUser.auth.getClaims(token)
  if (error || !data?.claims) throw new Error("UNAUTHORIZED")
  return data.claims.sub as string
}

// ─── MAIN HANDLER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    let userId: string;
    try {
      userId = await authenticateUser(req);
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { account_id, direction, event_id, action, task_id, target_calendar_id } = body;
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

    // Verify account ownership
    if (account.user_id && account.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const provider = account.provider;
    const isCalDav = ["caldav", "icloud", "nextcloud", "proton", "fastmail"].includes(provider);

    // ─── ZENFLOW TASK SYNC DIRECTIONS ───
    if (direction === "push_task") {
      if (!task_id || !action) {
        return new Response(
          JSON.stringify({ error: "task_id and action required for push_task" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Sync to ALL assigned users' calendars
      const results = await pushTaskToAssignees(task_id, action);
      return new Response(
        JSON.stringify({ success: true, synced: results.length, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (direction === "sync_pending_tasks") {
      const count = await syncPendingTasks(account, userId);
      return new Response(
        JSON.stringify({ success: true, synced: count }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (direction === "init_zenflow_calendar") {
      const token = await refreshGoogleToken(account);
      const calId = await getOrCreateZenflowCalendar(token, account.id);
      return new Response(
        JSON.stringify({ calendar_id: calId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── TEST ───
    // ─── LIST CALENDARS ───
    if (direction === "list_calendars") {
      if (provider !== "google") {
        return new Response(JSON.stringify({ calendars: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const token = await refreshGoogleToken(account);
      const listRes = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const list = await listRes.json();
      const calendars = (list.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summary,
        primary: c.primary ?? false,
      }));
      return new Response(JSON.stringify({ calendars }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
        // Use target_calendar_id if provided
        const pushAccount = target_calendar_id
          ? { ...account, calendar_id: target_calendar_id === '__zenflow__' ? null : target_calendar_id }
          : account;
        if (provider === "google") {
          if (target_calendar_id === '__zenflow__') {
            const token = await refreshGoogleToken(account);
            const zenCalId = await getOrCreateZenflowCalendar(token, account.id);
            await googlePushCreate({ ...account, calendar_id: zenCalId }, event);
          } else {
            await googlePushCreate(pushAccount, event);
          }
        }
        else if (isCalDav) await caldavPushCreate(account, event);
      } else if (action === "update") {
        if (evErr || !event) throw new Error("Event not found");
        if (provider === "google") await googlePushUpdate(account, event);
        else if (isCalDav) await caldavPushUpdate(account, event);
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
