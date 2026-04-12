import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../../shared/constants";
import type { ExtensionSettings } from "../types/settings";

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const saved = stored[STORAGE_KEYS.settings] as Partial<ExtensionSettings> | undefined;

  const migrated =
    saved?.backendBaseUrl === "http://localhost:8787"
      ? { ...saved, backendBaseUrl: DEFAULT_SETTINGS.backendBaseUrl }
      : saved;

  return {
    ...DEFAULT_SETTINGS,
    ...migrated
  };
}

export async function saveSettings(settings: Partial<ExtensionSettings>) {
  const next = {
    ...(await getSettings()),
    ...settings
  };

  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: next
  });

  return next;
}
