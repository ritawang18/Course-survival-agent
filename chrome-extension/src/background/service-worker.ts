import {
  askAgent,
  fetchContextSummary,
  fetchExtensionSessionState,
  type ExtensionSessionState
} from "../lib/api/backend-client";
import type { ContextSummaryResponse } from "../lib/types/api";
import type { CanvasPageContext } from "../lib/types/canvas";
import type { ExtensionMessage, MessageResponseMap } from "../lib/types/messages";
import { getSettings, saveSettings } from "../lib/storage/settings-store";
import { clearWebAuthToken, getWebAuthToken, saveWebAuthToken } from "../lib/storage/web-auth-store";
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "../shared/constants";
import { resolveWebAppBaseUrl, resolveWebAppTokenUrl } from "../shared/env";

const contextByTab = new Map<number, CanvasPageContext>();
const summaryByTab = new Map<number, ContextSummaryResponse>();
const WEB_UI_CONTENT_SCRIPT_ID = "course-survival-web-ui-auth";
let lastSessionState: ExtensionSessionState | null = null;
let webUiContentScriptSync: Promise<void> = Promise.resolve();

function buildDynamicWebUiMatches(rawWebAppBaseUrl: string) {
  try {
    const parsed = new URL(rawWebAppBaseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return [];
    }
    return [`${parsed.protocol}//${parsed.hostname}/*`];
  } catch {
    return [];
  }
}

async function ensureSettingsInitialized() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.settings);
  if (stored[STORAGE_KEYS.settings]) {
    return getSettings();
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: DEFAULT_SETTINGS
  });
  return DEFAULT_SETTINGS;
}

async function syncDynamicWebUiContentScriptNow() {
  if (!chrome.scripting?.registerContentScripts) {
    return;
  }

  const settings = await getSettings();
  const matches = buildDynamicWebUiMatches(settings.webAppBaseUrl);
  const desired = {
    id: WEB_UI_CONTENT_SCRIPT_ID,
    js: ["content.js"],
    matches,
    runAt: "document_idle" as const,
    persistAcrossSessions: true
  };

  const existing = chrome.scripting.getRegisteredContentScripts
    ? await chrome.scripting.getRegisteredContentScripts({
        ids: [WEB_UI_CONTENT_SCRIPT_ID]
      })
    : [];
  const current = existing[0];

  if (
    current &&
    JSON.stringify(current.matches ?? []) === JSON.stringify(desired.matches) &&
    JSON.stringify(current.js ?? []) === JSON.stringify(desired.js) &&
    current.runAt === desired.runAt &&
    current.persistAcrossSessions === desired.persistAcrossSessions
  ) {
    return;
  }

  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [WEB_UI_CONTENT_SCRIPT_ID]
    });
  } catch {
    // Ignore missing registration.
  }

  if (matches.length === 0) {
    return;
  }

  await chrome.scripting.registerContentScripts([desired]);
}

function syncDynamicWebUiContentScript() {
  webUiContentScriptSync = webUiContentScriptSync
    .catch(() => {
      // Keep the queue alive after prior failures.
    })
    .then(() => syncDynamicWebUiContentScriptNow());

  return webUiContentScriptSync;
}

async function notifyActiveTabChanged(reason: string, tabId?: number | null) {
  try {
    await chrome.runtime.sendMessage({
      type: "ACTIVE_TAB_CHANGED",
      payload: {
        tabId: tabId ?? null,
        reason
      }
    } satisfies ExtensionMessage);
  } catch {
    // Side panel may not be open; that's okay.
  }
}

function matchesPath(pathname: string, pattern: RegExp) {
  return pattern.test(pathname);
}

function detectPageFromPathname(pathname: string): CanvasPageContext["pageType"] {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (matchesPath(pathname, /^\/courses\/\d+\/assignments\/syllabus\/?$/)) return "syllabus";
  if (matchesPath(pathname, /^\/courses\/\d+\/assignments\/\d+\/?$/)) return "assignment";
  if (matchesPath(pathname, /^\/courses\/\d+\/modules(\/items\/\d+)?\/?$/)) return "module";
  if (matchesPath(pathname, /^\/courses\/\d+\/files(\/folder\/.+)?\/?$/)) return "files";
  if (matchesPath(pathname, /^\/courses\/\d+\/grades\/?$/)) return "grades";
  if (matchesPath(pathname, /^\/courses\/\d+\/?$/)) return "course_home";
  return "unknown";
}

function extractIdsFromPathname(pathname: string) {
  return {
    courseId: pathname.match(/\/courses\/(\d+)/)?.[1],
    assignmentId: pathname.match(/\/assignments\/(\d+)/)?.[1],
    moduleItemId: pathname.match(/\/modules\/items\/(\d+)/)?.[1]
  };
}

function parseMinimalContextFromUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    const ids = extractIdsFromPathname(pathname);

    return {
      url: parsed.href,
      origin: parsed.origin,
      pathname,
      pageType: detectPageFromPathname(pathname),
      courseId: ids.courseId,
      assignmentId: ids.assignmentId,
      moduleItemId: ids.moduleItemId,
      courseName: undefined,
      courseCode: undefined,
      pageTitle: undefined,
      detectedDueText: undefined,
      detectedPointsText: undefined,
      detectedSubmissionTypeText: undefined,
      rubricDetected: false,
      fileRestrictionsDetected: false,
      peerReviewDetected: false,
      mustViewDetected: false,
      modulePrerequisiteDetected: false,
      latePolicyText: undefined,
      attendancePolicyText: undefined,
      gradingWeightsText: undefined,
      examDatesText: undefined,
      folderName: undefined,
      nearestDueText: undefined,
      dashboardDeadlines: [],
      modulePastSummary: undefined,
      moduleNextSummary: undefined,
      rawDomHints: [],
      detectedAt: new Date().toISOString()
    } satisfies CanvasPageContext;
  } catch {
    return null;
  }
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true
  });
  return tab?.id ?? null;
}

async function getTabById(tabId: number) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function requestContextFromTab(tabId: number) {
  try {
    const context = (await chrome.tabs.sendMessage(tabId, {
      type: "GET_PAGE_CONTEXT"
    } satisfies ExtensionMessage)) as MessageResponseMap["GET_PAGE_CONTEXT"];

    if (context) {
      contextByTab.set(tabId, context);
    }

    return context;
  } catch {
    return contextByTab.get(tabId) ?? null;
  }
}

async function buildSummaryForTab(tabId: number, refresh = false) {
  if (!refresh && summaryByTab.has(tabId)) {
    return summaryByTab.get(tabId) ?? null;
  }

  const settings = await getSettings();
  const authToken = await getWebAuthToken();
  if (!authToken) {
    return null;
  }

  const tab = await getTabById(tabId);
  const minimalContext = tab?.url ? parseMinimalContextFromUrl(tab.url) : null;
  const context =
    (await requestContextFromTab(tabId)) ??
    contextByTab.get(tabId) ??
    minimalContext ??
    null;

  if (!context) return null;

  const sessionState = await fetchExtensionSessionState(settings, authToken);
  lastSessionState = sessionState;
  if (!sessionState?.authenticated) {
    await clearWebAuthToken();
    return null;
  }

  const backendSummary = await fetchContextSummary(
    settings,
    {
      context
    },
    authToken
  );

  if (backendSummary) {
    summaryByTab.set(tabId, backendSummary);
    return backendSummary;
  }
  return null;
}

function canUseSidePanelForUrl(url?: string) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

async function maybeEnableSidePanel(tabId: number, url?: string) {
  if (!chrome.sidePanel || !url) return;

  await chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: canUseSidePanelForUrl(url)
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureSettingsInitialized();
  await syncDynamicWebUiContentScript();

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
});

chrome.runtime.onStartup?.addListener(async () => {
  await ensureSettingsInitialized();
  await syncDynamicWebUiContentScript();

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !(STORAGE_KEYS.settings in changes)) {
    return;
  }

  void syncDynamicWebUiContentScript();
  void notifyActiveTabChanged("settings-updated");
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    contextByTab.delete(tabId);
    summaryByTab.delete(tabId);
  }

  await maybeEnableSidePanel(tabId, tab.url);

  if (changeInfo.url || changeInfo.status === "complete") {
    await notifyActiveTabChanged(changeInfo.url ? "tab-url-updated" : "tab-load-complete", tabId);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await getTabById(tabId);
  await maybeEnableSidePanel(tabId, tab?.url);
  await notifyActiveTabChanged("tab-activated", tabId);
});

chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "PAGE_CONTEXT_UPDATED": {
        const tabId = sender.tab?.id;
        if (tabId != null) {
          contextByTab.set(tabId, message.payload);
          summaryByTab.delete(tabId);
          await notifyActiveTabChanged("page-context-updated", tabId);
        }
        sendResponse({ ok: true } satisfies MessageResponseMap["PAGE_CONTEXT_UPDATED"]);
        return;
      }
      case "WEB_APP_AUTH_UPDATED": {
        if (message.payload.accessToken?.trim()) {
          await saveWebAuthToken(message.payload.accessToken);
        } else {
          await clearWebAuthToken();
          lastSessionState = null;
        }
        await notifyActiveTabChanged("web-auth-updated", sender.tab?.id);
        sendResponse({ ok: true } satisfies MessageResponseMap["WEB_APP_AUTH_UPDATED"]);
        return;
      }
      case "GET_ACTIVE_TAB_STATE": {
        const tabId = await getActiveTabId();
        const settings = await getSettings();
        const authToken = await getWebAuthToken();
        const sessionState =
          authToken ? await fetchExtensionSessionState(settings, authToken) : null;
        lastSessionState = sessionState;
        if (authToken && !sessionState?.authenticated) {
          await clearWebAuthToken();
        }
        const context = tabId != null ? (await requestContextFromTab(tabId)) : null;
        const summary = tabId != null ? summaryByTab.get(tabId) ?? null : null;

        sendResponse({
          context,
          summary,
          settings,
          isAuthenticated: Boolean(sessionState?.authenticated),
          hasCanvasToken: Boolean(sessionState?.hasCanvasToken)
        } satisfies MessageResponseMap["GET_ACTIVE_TAB_STATE"]);
        return;
      }
      case "GET_CONTEXT_SUMMARY": {
        const tabId = message.payload?.tabId ?? (await getActiveTabId());
        if (tabId == null) {
          sendResponse(null);
          return;
        }
        sendResponse(await buildSummaryForTab(tabId, message.payload?.refresh));
        return;
      }
      case "ASK_AGENT": {
        const settings = await getSettings();
        const authToken = await getWebAuthToken();
        if (!authToken) {
          sendResponse({
            answer: "Sign in through the Web UI first, then return to Canvas and reopen the extension.",
            followups: ["Open Web UI login", "Open Web UI settings"]
          } satisfies MessageResponseMap["ASK_AGENT"]);
          return;
        }
        sendResponse(await askAgent(settings, message.payload, authToken));
        return;
      }
      case "OPEN_OPTIONS": {
        await chrome.runtime.openOptionsPage();
        sendResponse({ ok: true } satisfies MessageResponseMap["OPEN_OPTIONS"]);
        return;
      }
      case "OPEN_FULL_WEB_APP": {
        const settings = await getSettings();
        await chrome.tabs.create({
          url: resolveWebAppBaseUrl(settings)
        });
        sendResponse({ ok: true } satisfies MessageResponseMap["OPEN_FULL_WEB_APP"]);
        return;
      }
      case "OPEN_WEB_APP_TOKEN_PAGE": {
        const settings = await getSettings();
        const tokenUrl = resolveWebAppTokenUrl(settings).trim();

        if (tokenUrl) {
          await chrome.tabs.create({
            url: tokenUrl
          });
          sendResponse({
            ok: true,
            fallbackToOptions: false
          } satisfies MessageResponseMap["OPEN_WEB_APP_TOKEN_PAGE"]);
          return;
        }

        await chrome.runtime.openOptionsPage();
        sendResponse({
          ok: true,
          fallbackToOptions: true
        } satisfies MessageResponseMap["OPEN_WEB_APP_TOKEN_PAGE"]);
        return;
      }
      case "OPEN_WEB_APP_LOGIN": {
        const settings = await getSettings();
        const tabId = await getActiveTabId();
        const tab = tabId != null ? await getTabById(tabId) : null;
        const loginBase = resolveWebAppBaseUrl(settings).trim();
        const loginUrl = new URL("/login", loginBase);
        if (tab?.url) {
          loginUrl.searchParams.set("next", tab.url);
        }

        await chrome.tabs.create({
          url: loginUrl.toString()
        });
        sendResponse({ ok: true } satisfies MessageResponseMap["OPEN_WEB_APP_LOGIN"]);
        return;
      }
      default: {
        sendResponse(null);
      }
    }
  })();

  return true;
});
