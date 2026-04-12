export type AIProvider = "openai" | "anthropic" | "gemini";

export const DEFAULT_MODEL_BY_PROVIDER: Record<AIProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  gemini: "gemini-2.5-flash",
};

export const MODEL_PRESETS: Record<AIProvider, string[]> = {
  openai: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"],
  anthropic: ["claude-sonnet-4-5", "claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest"],
  gemini: ["gemini-2.5-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
};
