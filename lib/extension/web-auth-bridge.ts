"use client";

export const WEB_AUTH_EVENT = "course-survival:web-auth-updated";

export function dispatchWebUiAuthToken(accessToken: string | null | undefined) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(WEB_AUTH_EVENT, {
      detail: {
        accessToken: typeof accessToken === "string" && accessToken.trim() ? accessToken : null,
      },
    })
  );
}
