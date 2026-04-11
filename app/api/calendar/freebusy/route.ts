import { NextRequest, NextResponse } from "next/server";
import { getFreeBusy } from "@/lib/google-calendar";
import { getCalendarClient } from "@/lib/calendar-auth";

export const runtime = "nodejs";

/** GET /api/calendar/freebusy?days=7&dayStart=8&dayEnd=22&minMinutes=45
 *  Returns free windows for the authenticated user's primary calendar.
 */
export async function GET(req: NextRequest) {
  const auth = await getCalendarClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { client } = auth;

  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? 7);
  const dayStartHour = Number(searchParams.get("dayStart") ?? 8);
  const dayEndHour = Number(searchParams.get("dayEnd") ?? 22);
  const minMinutes = Number(searchParams.get("minMinutes") ?? 45);

  try {
    const freeWindows = await getFreeBusy(client, {
      days,
      dayStartHour,
      dayEndHour,
      minMinutes,
    });
    return NextResponse.json({ freeWindows });
  } catch (err) {
    console.error("[freebusy]", err);
    return NextResponse.json({ error: "Failed to query calendar" }, { status: 500 });
  }
}
