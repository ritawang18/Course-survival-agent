import { getServiceClient } from "@/lib/supabase/server";

// `llm` is kept only as a legacy fallback for the earlier prototype.
export type IntegrationProvider = "llm" | "canvas";

interface UserIntegrationTokenRow {
  user_id: string;
  provider: IntegrationProvider;
  token: string;
  created_at: string;
  updated_at: string;
}

const TABLE = "user_integration_tokens";

function isMissingTableError(message: string) {
  return /does not exist|schema cache|relation .* does not exist/i.test(message);
}

export function maskToken(token: string): string {
  if (token.length <= 8) return "•".repeat(Math.max(4, token.length));
  return `${token.slice(0, 4)}••••••${token.slice(-4)}`;
}

export async function getUserIntegrationTokens(userId: string): Promise<UserIntegrationTokenRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("user_id, provider, token, created_at, updated_at")
    .eq("user_id", userId);

  if (error) {
    if (isMissingTableError(error.message)) return [];
    throw new Error(`getUserIntegrationTokens failed: ${error.message}`);
  }

  return (data ?? []) as UserIntegrationTokenRow[];
}

export async function getUserIntegrationToken(
  userId: string,
  provider: IntegrationProvider
): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("token")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) return null;
    throw new Error(`getUserIntegrationToken failed: ${error.message}`);
  }

  return (data?.token as string | undefined) ?? null;
}

export async function upsertUserIntegrationToken(
  userId: string,
  provider: IntegrationProvider,
  token: string
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_id: userId,
        provider,
        token,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" }
    );

  if (error) {
    throw new Error(`upsertUserIntegrationToken failed: ${error.message}`);
  }
}

export async function deleteUserIntegrationToken(
  userId: string,
  provider: IntegrationProvider
): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    if (isMissingTableError(error.message)) return;
    throw new Error(`deleteUserIntegrationToken failed: ${error.message}`);
  }
}
