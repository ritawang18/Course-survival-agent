import { STORAGE_KEYS } from "../../shared/constants";

export async function getCanvasToken() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.token);
  const token = stored[STORAGE_KEYS.token];
  return typeof token === "string" && token.trim() ? token : null;
}

export async function saveCanvasToken(token: string) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.token]: token.trim()
  });
}

export async function clearCanvasToken() {
  await chrome.storage.local.remove(STORAGE_KEYS.token);
}
