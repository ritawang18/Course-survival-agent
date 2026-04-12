import { NextResponse } from "next/server";
import {
  createOAuthClient,
  getAuthUrl,
  isMissingGoogleCalendarConfigError,
} from "@/lib/google-calendar";

export const runtime = "nodejs";

/** GET /api/calendar/auth → { url } */
export async function GET() {
  try {
    const client = createOAuthClient();
    const url = getAuthUrl(client);
    return NextResponse.json({ url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google Calendar is not configured.";
    return NextResponse.json(
      { error: message },
      { status: isMissingGoogleCalendarConfigError(error) ? 500 : 500 }
    );
  }
}
