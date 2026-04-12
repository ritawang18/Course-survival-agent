import { NextRequest, NextResponse } from "next/server";
import { listEvents, createEvent } from "@/lib/google-calendar";
import { getCalendarClient } from "@/lib/calendar-auth";

export const runtime = "nodejs";

/** GET /api/calendar/events?days=14 — list upcoming events */
export async function GET(req: NextRequest) {
  const auth = await getCalendarClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { client } = auth;

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
 *  Body: { summary, description?, start, end, colorId?, allDay?, timeZone? }
 */
export async function POST(req: NextRequest) {
  const auth = await getCalendarClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { client } = auth;

  const body = await req.json();
  const { summary, description, start, end, colorId, allDay, timeZone } = body;

  if (!summary || !start || !end) {
    return NextResponse.json({ error: "summary, start, and end are required" }, { status: 400 });
  }

  try {
    const eventId = await createEvent(client, {
      summary,
      description,
      start,
      end,
      colorId,
      allDay,
      timeZone,
    });
    return NextResponse.json({ eventId });
  } catch (err) {
    console.error("[events POST]", err);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
