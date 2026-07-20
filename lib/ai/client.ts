import { z } from "zod";
import { DEFAULT_MODEL_BY_PROVIDER, type AIProvider } from "@/lib/ai/models";
import { getUserLlmSettings } from "@/lib/db/user_llm_settings";
import { getUserIntegrationToken } from "@/lib/db/user_integration_tokens";

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

interface GenerateTextInput {
  config?: AIConfig | null;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}

interface GenerateObjectInput<T> extends GenerateTextInput {
  schema?: z.ZodType<T>;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string };
}

function maskProviderError(provider: AIProvider, status: number, detail?: string) {
  return `${provider} request failed (${status})${detail ? `: ${detail}` : ""}`;
}

function cleanTextResponse(text: string) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function ensureStructuredJsonInstructions(system: string, prompt: string) {
  const mentionsJson = /\bjson\b/i.test(system) || /\bjson\b/i.test(prompt);
  if (mentionsJson) {
    return { system, prompt };
  }

  return {
    system: `${system} Return a valid JSON object only.`,
    prompt: `Return only JSON that matches the requested schema.\n\n${prompt}`,
  };
}

function parseJsonText<T>(text: string, schema?: z.ZodType<T>): T {
  const cleaned = cleanTextResponse(text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown parse error";
    throw new Error(`Model returned invalid JSON: ${message}`);
  }

  return schema ? schema.parse(parsed) : (parsed as T);
}

function formatSchemaIssues(error: unknown) {
  if (!(error instanceof z.ZodError)) {
    return null;
  }

  return JSON.stringify(
    error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    })),
    null,
    2
  );
}

function getEnvApiKey(provider: AIProvider): string | null {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY ?? null;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY ?? null;
    case "gemini":
      return process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? null;
  }
}

function getEnvConfig(): AIConfig | null {
  const preferredProvider = process.env.LLM_PROVIDER as AIProvider | undefined;
  const preferredModel = process.env.LLM_MODEL;

  if (preferredProvider) {
    const apiKey = getEnvApiKey(preferredProvider);
    if (apiKey) {
      return {
        provider: preferredProvider,
        model: preferredModel ?? DEFAULT_MODEL_BY_PROVIDER[preferredProvider],
        apiKey,
      };
    }
  }

  const fallbackProviders: AIProvider[] = ["openai", "anthropic", "gemini"];
  for (const provider of fallbackProviders) {
    const apiKey = getEnvApiKey(provider);
    if (apiKey) {
      return {
        provider,
        model: DEFAULT_MODEL_BY_PROVIDER[provider],
        apiKey,
      };
    }
  }

  return null;
}

export async function resolveAIConfig(userId?: string | null): Promise<AIConfig | null> {
  if (userId) {
    const userSettings = await getUserLlmSettings(userId);
    if (userSettings) {
      return {
        provider: userSettings.provider,
        model: userSettings.model,
        apiKey: userSettings.api_key,
      };
    }

    // Legacy fallback for the earlier single-token prototype.
    const legacyToken = await getUserIntegrationToken(userId, "llm");
    if (legacyToken) {
      return {
        provider: "openai",
        model: DEFAULT_MODEL_BY_PROVIDER.openai,
        apiKey: legacyToken,
      };
    }
  }

  return getEnvConfig();
}

export async function requireAIConfig(userId?: string | null): Promise<AIConfig> {
  const config = await resolveAIConfig(userId);
  if (!config) {
    throw new Error(
      "No AI provider configured. Save provider/model/apiKey in settings or set server environment keys."
    );
  }
  return config;
}

async function callOpenAI(input: GenerateTextInput & { structured?: boolean }) {
  const { config, system, prompt, temperature = 0.2, maxOutputTokens = 2048, structured } = input;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config!.apiKey}`,
    },
    body: JSON.stringify({
      model: config!.model,
      temperature,
      max_tokens: maxOutputTokens,
      response_format: structured ? { type: "json_object" } : undefined,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  const body = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
  if (!res.ok) {
    throw new Error(maskProviderError("openai", res.status, body.error?.message));
  }

  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("openai returned an empty response");
  }
  return text;
}

async function callAnthropic(input: GenerateTextInput) {
  const { config, system, prompt, temperature = 0.2, maxOutputTokens = 2048 } = input;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config!.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config!.model,
      system,
      max_tokens: maxOutputTokens,
      temperature,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const body = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    throw new Error(maskProviderError("anthropic", res.status, body.error?.message));
  }

  const text = (body.content ?? [])
    .map((item) => item.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("anthropic returned an empty response");
  }
  return text;
}

async function callGemini(input: GenerateTextInput & { structured?: boolean }) {
  const { config, system, prompt, temperature = 0.2, maxOutputTokens = 2048, structured } = input;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config!.model)}` +
    `:generateContent?key=${encodeURIComponent(config!.apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: structured ? "application/json" : "text/plain",
      },
    }),
  });

  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    throw new Error(maskProviderError("gemini", res.status, body.error?.message));
  }

  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("gemini returned an empty response");
  }
  return text;
}

export async function generateTextWithAI(input: GenerateTextInput) {
  const config = input.config;
  if (!config) {
    throw new Error("Missing AI config for generateTextWithAI");
  }

  switch (config.provider) {
    case "openai":
      return { text: await callOpenAI({ ...input, config }) };
    case "anthropic":
      return { text: await callAnthropic({ ...input, config }) };
    case "gemini":
      return { text: await callGemini({ ...input, config }) };
  }
}

export async function generateObjectWithAI<T>(input: GenerateObjectInput<T>) {
  const config = input.config;
  if (!config) {
    throw new Error("Missing AI config for generateObjectWithAI");
  }

  const resolvedConfig = config;
  const structuredInput = ensureStructuredJsonInstructions(input.system, input.prompt);
  const maxOutputTokens = input.maxOutputTokens ?? 4096;

  async function requestStructuredText(system: string, prompt: string) {
    switch (resolvedConfig.provider) {
      case "openai":
        return callOpenAI({
          ...input,
          config: resolvedConfig,
          system,
          prompt,
          maxOutputTokens,
          structured: true,
        });
      case "anthropic":
        return callAnthropic({
          ...input,
          config: resolvedConfig,
          system,
          prompt,
          maxOutputTokens,
        });
      case "gemini":
        return callGemini({
          ...input,
          config: resolvedConfig,
          system,
          prompt,
          maxOutputTokens,
          structured: true,
        });
      default:
        throw new Error("Unsupported AI provider");
    }
  }

  const text = await requestStructuredText(structuredInput.system, structuredInput.prompt);

  try {
    return {
      text,
      object: parseJsonText<T>(text, input.schema),
    };
  } catch (parseError) {
    const schemaIssues = formatSchemaIssues(parseError);
    const retrySystem =
      `${structuredInput.system} ` +
      "Your response must be strict, complete, valid JSON with properly escaped strings.";
    const retryPrompt =
      `${structuredInput.prompt}\n\n` +
      "Return the full JSON object only. " +
      "Do not include markdown. " +
      "Do not include commentary before or after the JSON. " +
      "Make all string values short and concise so the JSON is not truncated." +
      (schemaIssues
        ? `\n\nThe previous response failed schema validation with these issues:\n${schemaIssues}\nFix every issue and include every required field.`
        : "");
    const retryText = await requestStructuredText(retrySystem, retryPrompt);

    try {
      return {
        text: retryText,
        object: parseJsonText<T>(retryText, input.schema),
      };
    } catch (retryParseError) {
      const message =
        retryParseError instanceof Error
          ? retryParseError.message
          : parseError instanceof Error
            ? parseError.message
            : "Model returned invalid JSON";
      throw new Error(message);
    }
  }

}

// ─────────────────────────────────────────────────────────────────────────────
// Native tool calling (Anthropic only for now)
//
// Additive path for the agent runtime. The existing generateTextWithAI /
// generateObjectWithAI text functions above are UNCHANGED and still used by the
// parsers, weekly pulse, etc. This path returns the model's tool calls as
// structured data instead of free text, so the brain's parser doesn't have to
// repair JSON out of prose.
//
// Only Anthropic is wired up. openai/gemini throw for now — add them later by
// following the same normalize-to-AgentTurnResult shape.
// ─────────────────────────────────────────────────────────────────────────────

/** A tool exposed to the model. `parameters` is a JSON Schema object (the brain
 *  produces it from the tool's Zod inputSchema via z.toJSONSchema). */
export interface LLMTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** A single structured tool call the model wants to make. */
export interface LLMToolCall {
  id: string;
  name: string;
  args: unknown;
}

/** Provider-agnostic conversation message. The planner maintains an array of
 *  these across ReAct turns. */
export type LLMMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content?: string | null; toolCalls?: LLMToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

/** Normalized result of one agent turn. `toolCalls` is empty when the model
 *  chose to answer; `text` holds that answer. */
export interface AgentTurnResult {
  text: string | null;
  toolCalls: LLMToolCall[];
  stopReason?: string;
  raw?: unknown;
}

interface GenerateAgentTurnInput {
  config: AIConfig;
  system: string;
  messages: LLMMessage[];
  tools: LLMTool[];
  temperature?: number;
  maxOutputTokens?: number;
}

// ── Anthropic wire types ──────────────────────────────────────────────────────

type AnthropicContentBlock =
  | { type: "text"; text?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: string; [key: string]: unknown };

interface AnthropicToolsResponse {
  content?: AnthropicContentBlock[];
  stop_reason?: string;
  error?: { message?: string };
}

// Outgoing Anthropic message content is either a plain string (user text) or an
// array of typed blocks (assistant tool_use, tool_result).
type AnthropicOutgoingMessage = {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
};

/**
 * Convert provider-agnostic LLMMessages into Anthropic's message format.
 * Consecutive `tool` messages are merged into a single user message holding all
 * their tool_result blocks — Anthropic disallows two user messages in a row and
 * expects all results for a turn in one message (matters once we do parallel
 * tool calls).
 */
function toAnthropicMessages(messages: LLMMessage[]): AnthropicOutgoingMessage[] {
  const out: AnthropicOutgoingMessage[] = [];
  let pendingToolResults: Array<Record<string, unknown>> = [];

  const flushToolResults = () => {
    if (pendingToolResults.length > 0) {
      out.push({ role: "user", content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const m of messages) {
    if (m.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
      });
      continue;
    }

    flushToolResults();

    if (m.role === "user") {
      out.push({ role: "user", content: m.content });
    } else {
      // assistant: text block (if any) + one tool_use block per call
      const blocks: Array<Record<string, unknown>> = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.args });
      }
      out.push({ role: "assistant", content: blocks.length > 0 ? blocks : "" });
    }
  }

  flushToolResults();
  return out;
}

async function callAnthropicTools(
  input: GenerateAgentTurnInput
): Promise<AgentTurnResult> {
  const { config, system, messages, tools, temperature = 0, maxOutputTokens = 1500 } = input;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxOutputTokens,
      temperature,
      system,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      messages: toAnthropicMessages(messages),
    }),
  });

  const body = (await res.json().catch(() => ({}))) as AnthropicToolsResponse;
  if (!res.ok) {
    throw new Error(maskProviderError("anthropic", res.status, body.error?.message));
  }

  const blocks = body.content ?? [];

  const text =
    blocks
      .filter((b): b is { type: "text"; text?: string } => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim() || null;

  const toolCalls: LLMToolCall[] = blocks
    .filter(
      (b): b is { type: "tool_use"; id?: string; name?: string; input?: unknown } =>
        b.type === "tool_use"
    )
    .map((b) => ({
      id: b.id ?? "",
      name: b.name ?? "",
      args: b.input ?? {},
    }));

  return { text, toolCalls, stopReason: body.stop_reason, raw: body };
}

/**
 * Run one agent turn with native tool calling. Returns structured tool calls
 * (empty when the model answers). Anthropic only for now — other providers throw.
 */
export async function generateAgentTurn(
  input: GenerateAgentTurnInput
): Promise<AgentTurnResult> {
  if (input.config.provider !== "anthropic") {
    throw new Error(
      `generateAgentTurn currently supports the anthropic provider only (got "${input.config.provider}"). ` +
        "Configure an Anthropic model in settings, or add native tool calling for this provider."
    );
  }
  return callAnthropicTools(input);
}
