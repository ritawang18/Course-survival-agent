import { STORAGE_KEYS } from "../../shared/constants";

export async function getWebAuthToken() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.webAuthToken);
  const token = stored[STORAGE_KEYS.webAuthToken];
  return typeof token === "string" && token.trim() ? token : null;
}

export async function saveWebAuthToken(token: string) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.webAuthToken]: token.trim()
  });
}

export async function clearWebAuthToken() {
  await chrome.storage.local.remove(STORAGE_KEYS.webAuthToken);
}
