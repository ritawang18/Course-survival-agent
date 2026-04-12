import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { getUserIntegrationToken } from "@/lib/db/user_integration_tokens";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
        hasCanvasToken: false
      },
      { status: 401 }
    );
  }

  const canvasToken = await getUserIntegrationToken(user.id, "canvas");

  return NextResponse.json({
    authenticated: true,
    hasCanvasToken: Boolean(canvasToken),
    email: user.email ?? null
  });
}
