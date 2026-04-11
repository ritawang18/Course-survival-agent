import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createOAuthClient,
  hydrateClient,
  listEvents,
  createEvent,
  TokenSet,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

/** GET /api/calendar/events?days=14 — list upcoming events */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("gcal_tokens")?.value;
  if (!raw) {
    return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
  }

  const tokens: TokenSet = JSON.parse(raw);
  const client = createOAuthClient();
  hydrateClient(client, tokens);

  const days = Number(new URL(req.url).searchParams.get("days") ?? 14);

  try {
    const events = await listEvents(client, days);
    return NextResponse.json({ events });
  } catch (err) {
    console.error("[events GET]", err);
    return NextResponse.json({ error: "Failed to list events" }, { status: 500 });
  }
}

/** POST /api/calendar/events — create a study block event
 *  Body: { summary, description?, start, end, colorId? }
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("gcal_tokens")?.value;
  if (!raw) {
    return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
  }

  const tokens: TokenSet = JSON.parse(raw);
  const client = createOAuthClient();
  hydrateClient(client, tokens);

  const body = await req.json();
  const { summary, description, start, end, colorId } = body;

  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start, and end are required" }, { status: 400 });
  }

  try {
    const eventId = await createEvent(client, { summary, description, start, end, colorId });
    return NextResponse.json({ eventId });
  } catch (err) {
    console.error("[events POST]", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
