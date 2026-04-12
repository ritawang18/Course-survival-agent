// NOTE: file is named claude.ts for historical reasons but now calls OpenAI.
// The exported `extractJSON` helper is provider-agnostic — importers
// (lib/parsers/*, lib/scheduler.ts) didn't need to change.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

interface OpenAIChatResponse {
  choices: { message: { content: string | null } }[];
  error?: { message: string };
}

/** Convenience: single-turn JSON extraction. Throws on parse failure. */
export async function extractJSON<T>(
  systemPrompt: string,
  userContent: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // OpenAI JSON mode: guarantees the response is valid JSON.
      // Requires the word "JSON" to appear in the system prompt — all
      // current callers already do.
      response_format: { type: "json_object" },
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as OpenAIChatResponse;
      detail = body.error?.message ?? "";
    } catch {
      // body wasn't JSON
    }
    throw new Error(
      `OpenAI request failed (${res.status})${detail ? `: ${detail}` : ""}`
    );
  }

  const body = (await res.json()) as OpenAIChatResponse;
  const text = body.choices?.[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("OpenAI returned an empty response");
  }

  // JSON mode shouldn't wrap in markdown fences, but be defensive.
  const cleaned = text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown parse error";
    throw new Error(`OpenAI returned non-JSON: ${message}`);
  }
}
