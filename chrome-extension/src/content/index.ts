import type { ExtensionMessage } from "../lib/types/messages";
import { getDashboardDebugSnapshot, parseCanvasContext } from "../lib/canvas/parse-context";
import { startDomObserver } from "./dom-observer";

const WEB_AUTH_EVENT = "course-survival:web-auth-updated";
const SETTINGS_STORAGE_KEY = "course-survival:settings";
const DEFAULT_WEB_APP_BASE_URL = "http://localhost:3000/dashboard";
let lastFingerprint = "";
let lastWebAuthToken = "";
let webUiOriginCache: string | null = null;

function isCanvasHost(hostname: string) {
  if (hostname.endsWith(".login.instructure.com")) {
    return false;
  }

  return hostname === "instructure.com" || hostname.endsWith(".instructure.com");
}

function isCanvasRelevantPath(pathname: string) {
  return pathname === "/" || pathname === "/dashboard" || pathname.startsWith("/courses/");
}

function isCanvasRelevantPage(locationLike: Location = window.location) {
  return isCanvasHost(locationLike.hostname) && isCanvasRelevantPath(locationLike.pathname);
}

function getCurrentContext() {
  return parseCanvasContext();
}

function sendContextUpdate() {
  const context = getCurrentContext();
  const nextFingerprint = JSON.stringify({
    url: context.url,
    pageType: context.pageType,
    title: context.pageTitle,
    due: context.detectedDueText,
    nearestDue: context.nearestDueText,
    deadlines: context.dashboardDeadlines,
    hints: context.rawDomHints
  });

  if (nextFingerprint === lastFingerprint) return;

  lastFingerprint = nextFingerprint;

  if (context.pageType === "dashboard") {
    console.debug("[Course Survival Agent][dashboard]", {
      context,
      debugSnapshot: getDashboardDebugSnapshot()
    });
  }

  chrome.runtime.sendMessage({
    type: "PAGE_CONTEXT_UPDATED",
    payload: context
  } satisfies ExtensionMessage);
}

function extractWebAuthTokenFromStorage() {
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw) as
          | { access_token?: string; currentSession?: { access_token?: string } }
          | Array<{ access_token?: string }>;

        if (Array.isArray(parsed)) {
          const token = parsed.find((item) => typeof item?.access_token === "string")?.access_token;
          if (token) return token;
        }

        if (typeof parsed.access_token === "string") return parsed.access_token;
        if (typeof parsed.currentSession?.access_token === "string") {
          return parsed.currentSession.access_token;
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function syncWebAppAuthIfNeeded() {
  let webAppOrigin = webUiOriginCache;
  if (!webAppOrigin) {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const saved = stored[SETTINGS_STORAGE_KEY] as { webAppBaseUrl?: string } | undefined;

    try {
      webAppOrigin = new URL(saved?.webAppBaseUrl ?? DEFAULT_WEB_APP_BASE_URL).origin;
      webUiOriginCache = webAppOrigin;
    } catch {
      return;
    }
  }

  if (window.location.origin !== webAppOrigin) {
    return;
  }

  const token = extractWebAuthTokenFromStorage() ?? "";
  if (token === lastWebAuthToken) return;
  lastWebAuthToken = token;

  chrome.runtime.sendMessage({
    type: "WEB_APP_AUTH_UPDATED",
    payload: { accessToken: token || null }
  } satisfies ExtensionMessage);
}

function handleWebAuthEvent(event: Event) {
  const detail =
    event instanceof CustomEvent
      ? (event.detail as { accessToken?: string | null } | null)
      : null;
  const token =
    typeof detail?.accessToken === "string" && detail.accessToken.trim()
      ? detail.accessToken
      : null;

  lastWebAuthToken = token ?? "";

  chrome.runtime.sendMessage({
    type: "WEB_APP_AUTH_UPDATED",
    payload: { accessToken: token }
  } satisfies ExtensionMessage);
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_CONTEXT") {
    sendResponse(isCanvasRelevantPage() ? getCurrentContext() : null);
  }
});

async function bootstrap() {
  if (isCanvasRelevantPage()) {
    sendContextUpdate();
    startDomObserver(sendContextUpdate);
    return;
  }

  await syncWebAppAuthIfNeeded();

  if (window.location.origin !== webUiOriginCache) {
    return;
  }

  window.addEventListener(WEB_AUTH_EVENT, handleWebAuthEvent);
  window.addEventListener("focus", () => {
    void syncWebAppAuthIfNeeded();
  });

  window.setInterval(() => {
    void syncWebAppAuthIfNeeded();
  }, 1000);
}

void bootstrap();
