import type { ExtensionSettings } from "../lib/types/settings";
import { DEFAULT_SETTINGS } from "./constants";

export function resolveBackendBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.backendBaseUrl ?? DEFAULT_SETTINGS.backendBaseUrl;
}

export function resolveWebAppBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.webAppBaseUrl ?? DEFAULT_SETTINGS.webAppBaseUrl;
}

export function resolveWebAppTokenUrl(settings?: Partial<ExtensionSettings>) {
  const baseUrl = resolveWebAppBaseUrl(settings).trim();
  if (!baseUrl) return new URL("/settings", DEFAULT_SETTINGS.webAppBaseUrl).toString();

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = "/settings";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return new URL("/settings", DEFAULT_SETTINGS.webAppBaseUrl).toString();
  }
}
