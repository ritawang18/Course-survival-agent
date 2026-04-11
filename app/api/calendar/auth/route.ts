import { NextResponse } from "next/server";
import { createOAuthClient, getAuthUrl } from "@/lib/google-calendar";

export const runtime = "nodejs";

/** GET /api/calendar/auth → { url } */
export async function GET() {
  const client = createOAuthClient();
  const url = getAuthUrl(client);
  return NextResponse.json({ url });
}
