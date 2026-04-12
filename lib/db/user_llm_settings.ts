import { getServiceClient } from "@/lib/supabase/server";
import type { AIProvider } from "@/lib/ai/models";

const TABLE = "user_llm_settings";

export interface UserLlmSettingsRow {
  user_id: string;
  provider: AIProvider;
  model: string;
  api_key: string;
  created_at: string;
  updated_at: string;
}

function isMissingTableError(message: string) {
  return /does not exist|schema cache|relation .* does not exist/i.test(message);
}

export async function getUserLlmSettings(userId: string): Promise<UserLlmSettingsRow | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("user_id, provider, model, api_key, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error.message)) return null;
    throw new Error(`getUserLlmSettings failed: ${error.message}`);
  }

  return (data as UserLlmSettingsRow | null) ?? null;
}

export async function upsertUserLlmSettings(input: {
  userId: string;
  provider: AIProvider;
  model: string;
  apiKey: string;
}): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_id: input.userId,
      provider: input.provider,
      model: input.model,
      api_key: input.apiKey,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`upsertUserLlmSettings failed: ${error.message}`);
  }
}

export async function deleteUserLlmSettings(userId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId);

  if (error) {
    if (isMissingTableError(error.message)) return;
    throw new Error(`deleteUserLlmSettings failed: ${error.message}`);
  }
}
