import type { ExtensionSettings } from "../lib/types/settings";

export const STORAGE_KEYS = {
  settings: "course-survival:settings",
  token: "course-survival:canvas-token",
  webAuthToken: "course-survival:web-auth-token"
} as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendBaseUrl: "http://localhost:3000/api",
  webAppBaseUrl: "http://localhost:3000/dashboard",
  debugMode: false
};
