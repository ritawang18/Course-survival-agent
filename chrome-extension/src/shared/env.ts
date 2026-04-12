import type { ExtensionSettings } from "../lib/types/settings";
import { DEFAULT_SETTINGS } from "./constants";

export function resolveBackendBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.backendBaseUrl ?? DEFAULT_SETTINGS.backendBaseUrl;
}

export function resolveWebAppBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.webAppBaseUrl ?? DEFAULT_SETTINGS.webAppBaseUrl;
}

export function resolveWebAppTokenUrl(settings?: Partial<ExtensionSettings>) {
  const explicit = settings?.webAppTokenUrl?.trim();
  if (explicit) return explicit;

  const baseUrl = resolveWebAppBaseUrl(settings).trim();
  if (!baseUrl) return DEFAULT_SETTINGS.webAppTokenUrl;

  try {
    const parsed = new URL(baseUrl);
    parsed.pathname = "/settings";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return DEFAULT_SETTINGS.webAppTokenUrl;
  }
}
