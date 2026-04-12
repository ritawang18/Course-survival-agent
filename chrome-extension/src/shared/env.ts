import type { ExtensionSettings } from "../lib/types/settings";
import { DEFAULT_SETTINGS } from "./constants";

export function resolveBackendBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.backendBaseUrl ?? DEFAULT_SETTINGS.backendBaseUrl;
}

export function resolveWebAppBaseUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.webAppBaseUrl ?? DEFAULT_SETTINGS.webAppBaseUrl;
}

export function resolveWebAppTokenUrl(settings?: Partial<ExtensionSettings>) {
  return settings?.webAppTokenUrl ?? DEFAULT_SETTINGS.webAppTokenUrl;
}
