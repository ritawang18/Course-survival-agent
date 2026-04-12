// NOTE: file is named claude.ts for historical reasons.
// It now routes all structured generation through the shared AI client.

import type { AIConfig } from "@/lib/ai/client";
import { generateObjectWithAI, requireAIConfig } from "@/lib/ai/client";

interface ExtractJsonOptions extends Partial<AIConfig> {}

/** Convenience: single-turn JSON extraction. Throws on parse failure. */
export async function extractJSON<T>(
  systemPrompt: string,
  userContent: string,
  options?: ExtractJsonOptions
): Promise<T> {
  const config =
    options?.provider && options?.model && options?.apiKey
      ? {
          provider: options.provider,
          model: options.model,
          apiKey: options.apiKey,
        }
      : options?.apiKey
      ? {
          provider: options.provider ?? "openai",
          model: options.model ?? "gpt-4o-mini",
          apiKey: options.apiKey,
        }
      : await requireAIConfig();

  const { object } = await generateObjectWithAI<T>({
    config,
    system: systemPrompt,
    prompt: userContent,
  });

  return object;
}
