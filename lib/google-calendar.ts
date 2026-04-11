import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

/** Build the URL users visit to grant access. */
export function getAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // always get refresh token
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  });
}

export interface TokenSet {
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
}

/** Exchange authorization code for tokens. */
export async function exchangeCode(
  client: OAuth2Client,
  code: string
): Promise<TokenSet> {
  const { tokens } = await client.getToken(code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? null,
  };
}

/** Restore credentials from a stored token set. */
export function hydrateClient(client: OAuth2Client, tokens: TokenSet): void {
  client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  });
}

// ── Calendar operations ─────────────────────────────────────────────────────

export interface FreeBusySlot {
  start: string; // ISO
  end: string;
}

export interface FreeWindow {
  date: string;  // YYYY-MM-DD
  slots: { start: string; end: string }[]; // HH:mm
}

/**
 * Query free/busy for the next `days` days and return free windows
 * that are ≥ minMinutes long within the day window [dayStart, dayEnd].
 */
export async function getFreeBusy(
  client: OAuth2Client,
  options: {
    days?: number;
    dayStartHour?: number;
    dayEndHour?: number;
    minMinutes?: number;
  } = {}
): Promise<FreeWindow[]> {
  const {
    days = 7,
    dayStartHour = 8,
    dayEndHour = 22,
    minMinutes = 45,
  } = options;

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + days * 86_400_000).toISOString();

  const cal = google.calendar({ version: "v3", auth: client });
  const resp = await cal.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });

  const busy: FreeBusySlot[] =
    (resp.data.calendars?.["primary"]?.busy ?? []).map((b) => ({
      start: b.start!,
      end: b.end!,
    }));

  // Build per-day free windows
  const result: FreeWindow[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const dateStr = day.toISOString().slice(0, 10);

    const dayStartMin = dayStartHour * 60;
    const dayEndMin = dayEndHour * 60;

    // Collect busy intervals that overlap this day
    const dayBusy = busy
      .filter((b) => b.start.slice(0, 10) === dateStr || b.end.slice(0, 10) === dateStr)
      .map((b) => ({
        s: Math.max(toMinOfDay(b.start), dayStartMin),
        e: Math.min(toMinOfDay(b.end), dayEndMin),
      }))
      .filter((b) => b.s < b.e);

    dayBusy.sort((a, b) => a.s - b.s);

    // Merge overlapping busy intervals
    const merged: { s: number; e: number }[] = [];
    for (const b of dayBusy) {
      const last = merged[merged.length - 1];
      if (last && b.s <= last.e) last.e = Math.max(last.e, b.e);
      else merged.push({ ...b });
    }

    // Find free gaps
    const slots: { start: string; end: string }[] = [];
    let cursor = dayStartMin;
    for (const b of merged) {
      if (b.s > cursor && b.s - cursor >= minMinutes) {
        slots.push({ start: fmtMin(cursor), end: fmtMin(b.s) });
      }
      cursor = Math.max(cursor, b.e);
    }
    if (dayEndMin > cursor && dayEndMin - cursor >= minMinutes) {
      slots.push({ start: fmtMin(cursor), end: fmtMin(dayEndMin) });
    }

    result.push({ date: dateStr, slots });
  }

  return result;
}

/** List upcoming calendar events. */
export async function listEvents(
  client: OAuth2Client,
  days = 14
): Promise<{ id: string; summary: string; start: string; end: string }[]> {
  const cal = google.calendar({ version: "v3", auth: client });
  const now = new Date();
  const resp = await cal.events.list({
    calendarId: "primary",
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + days * 86_400_000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (resp.data.items ?? []).map((e) => ({
    id: e.id!,
    summary: e.summary ?? "(no title)",
    start: e.start?.dateTime ?? e.start?.date ?? "",
    end: e.end?.dateTime ?? e.end?.date ?? "",
  }));
}

/** Create a calendar event (e.g. a study block or exam). */
export async function createEvent(
  client: OAuth2Client,
  event: {
    summary: string;
    description?: string;
    start: string;   // ISO datetime, or YYYY-MM-DD for all-day
    end: string;     // ISO datetime, or YYYY-MM-DD for all-day
    colorId?: string; // "1"–"11"
    allDay?: boolean; // true → uses date field instead of dateTime
    timeZone?: string; // defaults to UTC
  }
): Promise<string> {
  const cal = google.calendar({ version: "v3", auth: client });
  const tz = event.timeZone ?? "UTC";

  const startField = event.allDay
    ? { date: event.start.slice(0, 10) }
    : { dateTime: event.start, timeZone: tz };

  const endField = event.allDay
    ? { date: event.end.slice(0, 10) }
    : { dateTime: event.end, timeZone: tz };

  const resp = await cal.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.summary,
      description: event.description,
      colorId: event.colorId,
      start: startField,
      end: endField,
    },
  });
  return resp.data.id!;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function toMinOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtMin(min: number): string {
  return `${Math.floor(min / 60).toString().padStart(2, "0")}:${(min % 60).toString().padStart(2, "0")}`;
}
