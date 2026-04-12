import type { CanvasPageType } from "../types/canvas";

function matches(pathname: string, pattern: RegExp) {
  return pattern.test(pathname);
}

export function detectCanvasPage(pathname: string): CanvasPageType {
  if (pathname === "/" || pathname === "/dashboard") return "dashboard";
  if (matches(pathname, /^\/courses\/\d+\/assignments\/syllabus\/?$/)) return "syllabus";
  if (matches(pathname, /^\/courses\/\d+\/assignments\/\d+\/?$/)) return "assignment";
  if (matches(pathname, /^\/courses\/\d+\/modules(\/items\/\d+)?\/?$/)) return "module";
  if (matches(pathname, /^\/courses\/\d+\/files(\/folder\/.+)?\/?$/)) return "files";
  if (matches(pathname, /^\/courses\/\d+\/grades\/?$/)) return "grades";
  if (matches(pathname, /^\/courses\/\d+\/?$/)) return "course_home";
  return "unknown";
}

export function extractIds(pathname: string) {
  return {
    courseId: pathname.match(/\/courses\/(\d+)/)?.[1],
    assignmentId: pathname.match(/\/assignments\/(\d+)/)?.[1],
    moduleItemId: pathname.match(/\/modules\/items\/(\d+)/)?.[1]
  };
}

export function parseMinimalCanvasContextFromUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const pathname = parsed.pathname;
    const ids = extractIds(pathname);

    return {
      url: parsed.href,
      origin: parsed.origin,
      pathname,
      pageType: detectCanvasPage(pathname),
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
    };
  } catch {
    return null;
  }
}
