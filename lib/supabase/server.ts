import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Service-role Supabase client for use in API routes.
 * Bypasses Row Level Security — only use server-side.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env
 */
export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extracts and verifies the Supabase JWT from the Authorization header.
 * Returns the authenticated user, or null if missing/invalid.
 *
 * The frontend must send:  Authorization: Bearer <supabase_access_token>
 *
 * Two-stage check:
 *   1. `auth.getUser(token)` decodes & signature-verifies the JWT.
 *   2. `auth.admin.getUserById()` confirms the user actually exists in
 *      *this* project's `auth.users`.
 *
 * Stage 2 exists because stage 1 alone accepts any JWT whose signature
 * matches — including tokens issued by a different Supabase project that
 * happens to share a JWT secret, or leftover `sb-*` localStorage entries
 * from a time when NEXT_PUBLIC_SUPABASE_URL pointed at a different project.
 * Without the lookup, such tokens would pass auth and later crash as an
 * opaque `courses_user_id_fkey` FK violation when the insert tried to
 * reference an `auth.users` row that never existed here.
 */
export async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;

  const supabase = getServiceClient();

  // Stage 1: decode + signature check
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  // Stage 2: confirm the user actually exists in this project's auth.users.
  // Uses the admin API (requires service-role key — which we already have).
  const { data: adminLookup, error: adminErr } =
    await supabase.auth.admin.getUserById(data.user.id);
  if (adminErr || !adminLookup.user) {
    console.warn(
      `[auth] rejected stale token: sub=${data.user.id} not in auth.users. ` +
        `Browser is probably carrying a session from a different Supabase project.`
    );
    return null;
  }

  return data.user;
}
