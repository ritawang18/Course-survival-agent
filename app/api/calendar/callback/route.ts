import { NextRequest, NextResponse } from "next/server";
import { createOAuthClient, exchangeCode, TokenSet } from "@/lib/google-calendar";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/** GET /api/calendar/callback?code=...&state=...
 *  Exchanges the authorization code for tokens and stores them in an
 *  httpOnly cookie, then redirects back to /calendar.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/calendar?error=${encodeURIComponent(error ?? "no_code")}`, req.url)
    );
  }

  try {
    const client = createOAuthClient();
    const tokens: TokenSet = await exchangeCode(client, code);

    // Store tokens in a server-side httpOnly cookie (simple persistence)
    const cookieStore = await cookies();
    cookieStore.set("gcal_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.redirect(new URL("/calendar?connected=1", req.url));
  } catch (err) {
    console.error("[calendar/callback]", err);
    return NextResponse.redirect(new URL("/calendar?error=token_exchange", req.url));
  }
}
