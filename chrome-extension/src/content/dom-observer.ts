export function startDomObserver(onChange: () => void) {
  let timeoutId: number | undefined;

  const schedule = () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(onChange, 250);
  };

  const observer = new MutationObserver(schedule);

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  const patchHistoryMethod = (method: "pushState" | "replaceState") => {
    const original = history[method];
    history[method] = function patchedHistory(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("course-survival:navigation"));
      return result;
    };
  };

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("course-survival:navigation", schedule);

  return () => {
    observer.disconnect();
    window.removeEventListener("popstate", schedule);
    window.removeEventListener("hashchange", schedule);
    window.removeEventListener("course-survival:navigation", schedule);
  };
}
