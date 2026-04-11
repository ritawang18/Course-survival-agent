import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createOAuthClient,
  hydrateClient,
  getFreeBusy,
  TokenSet,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

/** GET /api/calendar/freebusy?days=7&dayStart=8&dayEnd=22&minMinutes=45
 *  Returns free windows for the authenticated user's primary calendar.
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const raw = cookieStore.get("gcal_tokens")?.value;
  if (!raw) {
    return NextResponse.json({ error: "Not connected to Google Calendar" }, { status: 401 });
  }

  const tokens: TokenSet = JSON.parse(raw);
  const client = createOAuthClient();
  hydrateClient(client, tokens);

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
