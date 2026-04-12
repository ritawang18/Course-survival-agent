import { askAgent, buildFallbackSummary, fetchContextSummary } from "../lib/api/backend-client";
import { fetchCanvasEnrichment } from "../lib/api/canvas-client";
import type { ContextSummaryResponse } from "../lib/types/api";
import type { CanvasPageContext } from "../lib/types/canvas";
import type { ExtensionMessage, MessageResponseMap } from "../lib/types/messages";
import { getSettings, saveSettings } from "../lib/storage/settings-store";
import { getCanvasToken } from "../lib/storage/token-store";
import { DEFAULT_SETTINGS } from "../shared/constants";
import { resolveWebAppBaseUrl, resolveWebAppTokenUrl } from "../shared/env";

const contextByTab = new Map<number, CanvasPageContext>();
const summaryByTab = new Map<number, ContextSummaryResponse>();

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
  const tab = await getTabById(tabId);
  const minimalContext = tab?.url ? parseMinimalContextFromUrl(tab.url) : null;
  const context =
    (await requestContextFromTab(tabId)) ??
    contextByTab.get(tabId) ??
    minimalContext ??
    null;

  if (!context) return null;

  const backendSummary = await fetchContextSummary(settings, {
    context
  });

  if (backendSummary) {
    summaryByTab.set(tabId, backendSummary);
    return backendSummary;
  }

  const token = await getCanvasToken();
  const enrichment =
    token && settings.enableCanvasApiEnrichment
      ? await fetchCanvasEnrichment(context, token)
      : null;

  const enrichedContext: CanvasPageContext = {
    ...context,
    nearestDueText: enrichment?.nearestDueText ?? context.nearestDueText,
    dashboardDeadlines:
      enrichment?.dashboardDeadlines && enrichment.dashboardDeadlines.length > 0
        ? enrichment.dashboardDeadlines
        : context.dashboardDeadlines,
    modulePastSummary: enrichment?.modulePastSummary ?? context.modulePastSummary,
    moduleNextSummary: enrichment?.moduleNextSummary ?? context.moduleNextSummary
  };

  const summary = buildFallbackSummary(
    enrichedContext,
    enrichment?.courseSnapshot,
    enrichment?.assignmentSnapshot,
    enrichment?.gradeSnapshot,
    enrichment ? "canvas_api" : "dom_fallback"
  );

  summaryByTab.set(tabId, summary);
  return summary;
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
  await saveSettings(DEFAULT_SETTINGS);

  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
});

chrome.runtime.onStartup?.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({
      openPanelOnActionClick: true
    });
  }
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
      case "GET_ACTIVE_TAB_STATE": {
        const tabId = await getActiveTabId();
        const settings = await getSettings();
        const hasToken = Boolean(await getCanvasToken());
        const context = tabId != null ? (await requestContextFromTab(tabId)) : null;
        const summary = tabId != null ? summaryByTab.get(tabId) ?? null : null;

        sendResponse({
          context,
          summary,
          settings,
          hasToken
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
        sendResponse(await askAgent(settings, message.payload));
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
      default: {
        sendResponse(null);
      }
    }
  })();

  return true;
});
