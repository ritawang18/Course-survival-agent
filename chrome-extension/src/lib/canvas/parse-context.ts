import type { CanvasPageContext } from "../types/canvas";
import { detectCanvasPage, extractIds } from "./detect-page";
import { canvasSelectors } from "./selectors";

function findFirstText(selectors: readonly string[]) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text) return text;
  }
  return undefined;
}

function bodyText() {
  return document.body?.innerText ?? "";
}

function includesPhrase(phrase: string) {
  return bodyText().toLowerCase().includes(phrase.toLowerCase());
}

function extractLineMatching(pattern: RegExp) {
  const lines = bodyText()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.find((line) => pattern.test(line));
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function uniqueNonEmpty(values: string[]) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)));
}

function queryTexts(selectors: readonly string[]) {
  const bySelector: Record<string, string[]> = {};

  for (const selector of selectors) {
    const texts = Array.from(document.querySelectorAll(selector))
      .map((item) => item.textContent ?? "")
      .map(normalizeText)
      .filter(Boolean);

    if (texts.length > 0) {
      bySelector[selector] = uniqueNonEmpty(texts);
    }
  }

  return bySelector;
}

function extractDueLikeLines() {
  return uniqueNonEmpty(
    bodyText()
      .split("\n")
      .map((line) => line.trim())
      .filter((line) =>
        /due|tomorrow|today|overdue|am|pm|available until|until|lock|unlock/i.test(line)
      )
  );
}

function extractDashboardDeadlines() {
  const matchesBySelector = queryTexts(canvasSelectors.dashboardDeadlineItems);

  const values = new Set<string>();

  for (const texts of Object.values(matchesBySelector)) {
    for (const text of texts) {
      if (text) values.add(text);
      if (values.size >= 3) break;
    }
    if (values.size >= 3) break;
  }

  if (values.size > 0) {
    return Array.from(values).slice(0, 3);
  }

  return extractDueLikeLines().slice(0, 3);
}

export function getDashboardDebugSnapshot() {
  const matchesBySelector = queryTexts(canvasSelectors.dashboardDeadlineItems);
  const matchedSelectors = Object.keys(matchesBySelector);
  const flattenedTexts = uniqueNonEmpty(Object.values(matchesBySelector).flat());
  const fallbackDueLines = extractDueLikeLines().slice(0, 8);

  return {
    href: window.location.href,
    title: document.title,
    matchedSelectors,
    matchesBySelector,
    fallbackDueLines,
    chosenDeadlines: extractDashboardDeadlines(),
    nearestDueCandidate:
      extractDashboardDeadlines()[0] ?? extractLineMatching(/due|until|overdue|today|tomorrow/i)
  };
}

function collectHints() {
  const hints: string[] = [];

  if (includesPhrase("rubric")) hints.push("rubric");
  if (includesPhrase("allowed file types")) hints.push("allowed-file-types");
  if (includesPhrase("peer review")) hints.push("peer-review");
  if (includesPhrase("module prerequisite")) hints.push("module-prerequisite");
  if (includesPhrase("must view")) hints.push("must-view");
  if (includesPhrase("late policy")) hints.push("late-policy");
  if (includesPhrase("attendance")) hints.push("attendance");
  if (includesPhrase("grading")) hints.push("grading");
  if (includesPhrase("exam")) hints.push("exam");

  return hints;
}

export function parseCanvasContext(locationLike: Location = window.location): CanvasPageContext {
  const pathname = locationLike.pathname;
  const pageType = detectCanvasPage(pathname);
  const ids = extractIds(pathname);
  const hints = collectHints();
  const dashboardDeadlines = pageType === "dashboard" ? extractDashboardDeadlines() : [];
  const nearestDueText =
    dashboardDeadlines[0] ?? extractLineMatching(/due|until|overdue|today|tomorrow/i);

  return {
    url: locationLike.href,
    origin: locationLike.origin,
    pathname,
    pageType,
    courseId: ids.courseId,
    assignmentId: ids.assignmentId,
    moduleItemId: ids.moduleItemId,
    courseName: findFirstText(canvasSelectors.courseName),
    courseCode: findFirstText(canvasSelectors.courseCode),
    pageTitle: findFirstText(canvasSelectors.title) ?? document.title,
    detectedDueText: findFirstText(canvasSelectors.dueText),
    detectedPointsText: findFirstText(canvasSelectors.pointsText),
    detectedSubmissionTypeText: findFirstText(canvasSelectors.submissionTypeText),
    rubricDetected: hints.includes("rubric"),
    fileRestrictionsDetected: hints.includes("allowed-file-types"),
    peerReviewDetected: hints.includes("peer-review"),
    mustViewDetected: hints.includes("must-view"),
    modulePrerequisiteDetected: hints.includes("module-prerequisite"),
    latePolicyText: extractLineMatching(/late/i),
    attendancePolicyText: extractLineMatching(/attendance/i),
    gradingWeightsText: extractLineMatching(/grading|weight/i),
    examDatesText: extractLineMatching(/exam|midterm|final/i),
    folderName: findFirstText(canvasSelectors.folderName),
    nearestDueText,
    dashboardDeadlines,
    modulePastSummary: undefined,
    moduleNextSummary: undefined,
    rawDomHints: hints,
    detectedAt: new Date().toISOString()
  };
}
