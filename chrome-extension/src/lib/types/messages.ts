import type { AskAgentRequest, AskAgentResponse, ContextSummaryResponse } from "./api";
import type { CanvasPageContext } from "./canvas";
import type { ExtensionSettings } from "./settings";

export type ExtensionMessage =
  | { type: "GET_PAGE_CONTEXT" }
  | { type: "PAGE_CONTEXT_UPDATED"; payload: CanvasPageContext }
  | { type: "WEB_APP_AUTH_UPDATED"; payload: { accessToken: string | null } }
  | { type: "ACTIVE_TAB_CHANGED"; payload: { tabId?: number | null; reason: string } }
  | { type: "GET_ACTIVE_TAB_STATE" }
  | { type: "GET_CONTEXT_SUMMARY"; payload?: { refresh?: boolean; tabId?: number } }
  | { type: "ASK_AGENT"; payload: AskAgentRequest }
  | { type: "OPEN_OPTIONS" }
  | { type: "OPEN_WEB_APP_TOKEN_PAGE" }
  | { type: "OPEN_WEB_APP_LOGIN" }
  | { type: "OPEN_FULL_WEB_APP" };

export interface ActiveTabState {
  context: CanvasPageContext | null;
  summary: ContextSummaryResponse | null;
  settings: ExtensionSettings;
  isAuthenticated: boolean;
  hasCanvasToken: boolean;
}

export interface MessageResponseMap {
  GET_PAGE_CONTEXT: CanvasPageContext | null;
  PAGE_CONTEXT_UPDATED: { ok: true };
  WEB_APP_AUTH_UPDATED: { ok: true };
  ACTIVE_TAB_CHANGED: null;
  GET_ACTIVE_TAB_STATE: ActiveTabState;
  GET_CONTEXT_SUMMARY: ContextSummaryResponse | null;
  ASK_AGENT: AskAgentResponse;
  OPEN_OPTIONS: { ok: true };
  OPEN_WEB_APP_TOKEN_PAGE: { ok: true; fallbackToOptions?: boolean };
  OPEN_WEB_APP_LOGIN: { ok: true };
  OPEN_FULL_WEB_APP: { ok: true };
}
