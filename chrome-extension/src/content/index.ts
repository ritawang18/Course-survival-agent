import type { ExtensionMessage } from "../lib/types/messages";
import { getDashboardDebugSnapshot, parseCanvasContext } from "../lib/canvas/parse-context";
import { startDomObserver } from "./dom-observer";

let lastFingerprint = "";

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

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "GET_PAGE_CONTEXT") {
    sendResponse(getCurrentContext());
  }
});

sendContextUpdate();
startDomObserver(sendContextUpdate);
