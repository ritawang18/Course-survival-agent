import { cookies } from "next/headers";
import { OAuth2Client } from "google-auth-library";
import {
  createOAuthClient,
  hydrateClient,
  isMissingGoogleCalendarConfigError,
  TokenSet,
} from "@/lib/google-calendar";

export interface AuthGuardSuccess {
  ok: true;
  client: OAuth2Client;
}

export interface AuthGuardFailure {
  ok: false;
  status: 401 | 500;
  error: string;
}

export type AuthGuardResult = AuthGuardSuccess | AuthGuardFailure;

/**
 * Reads the gcal_tokens cookie, hydrates an OAuth2 client, and refreshes
 * the access token if it has expired (or is within 5 minutes of expiry).
 * If the token was refreshed, the cookie is updated in place.
 *
 * Usage in a route:
 *   const auth = await getCalendarClient();
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   const { client } = auth;
 */
export async function getCalendarClient(): Promise<AuthGuardResult> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("gcal_tokens")?.value;

  if (!raw) {
    return {
      ok: false,
      status: 401,
      error: "Not connected to Google Calendar. Authorize at /api/calendar/auth.",
    };
  }

  let tokens: TokenSet;
  try {
    tokens = JSON.parse(raw);
  } catch {
    return { ok: false, status: 401, error: "Malformed token cookie. Please re-authorize." };
  }

  if (!tokens.access_token) {
    return { ok: false, status: 401, error: "Missing access token. Please re-authorize." };
  }

  let client: OAuth2Client;
  try {
    client = createOAuthClient();
  } catch (error) {
    return {
      ok: false,
      status: isMissingGoogleCalendarConfigError(error) ? 500 : 500,
      error:
        error instanceof Error
          ? error.message
          : "Google Calendar is not configured.",
    };
  }

  hydrateClient(client, tokens);

  // Refresh if expired or expiring within 5 minutes
  if (isExpiringSoon(tokens.expiry_date)) {
    if (!tokens.refresh_token) {
      return {
        ok: false,
        status: 401,
        error: "Access token expired and no refresh token available. Please re-authorize.",
      };
    }

    try {
      const { credentials } = await client.refreshAccessToken();

      const refreshed: TokenSet = {
        access_token: credentials.access_token!,
        refresh_token: (credentials.refresh_token ?? tokens.refresh_token) as string | null,
        expiry_date: credentials.expiry_date ?? null,
      };

      // Persist updated tokens back to the cookie
      cookieStore.set("gcal_tokens", JSON.stringify(refreshed), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });

      hydrateClient(client, refreshed);
    } catch (err) {
      console.error("[calendar-auth] Token refresh failed:", err);
      return {
        ok: false,
        status: 401,
        error: "Failed to refresh access token. Please re-authorize.",
      };
    }
  }

  return { ok: true, client };
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Returns true if the token is expired or expires within 5 minutes. */
function isExpiringSoon(expiryDate: number | null): boolean {
  if (!expiryDate) return false; // no expiry info → assume valid
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() >= expiryDate - fiveMinutes;
}
