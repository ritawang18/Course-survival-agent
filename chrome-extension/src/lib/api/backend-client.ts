import type { AskAgentRequest, AskAgentResponse, ChecklistItem, ContextSummaryResponse, RiskAlert, SummaryDataSource } from "../types/api";
import type { CanvasAssignmentSnapshot, CanvasCourseSnapshot, CanvasGradeSnapshot, CanvasPageContext, CanvasPageType } from "../types/canvas";
import type { ExtensionSettings } from "../types/settings";
import { resolveBackendBaseUrl } from "../../shared/env";

interface SummaryPayload {
  context: CanvasPageContext;
  courseSnapshot?: CanvasCourseSnapshot;
  assignmentSnapshot?: CanvasAssignmentSnapshot;
}

function promptsForPage(pageType: CanvasPageType) {
  switch (pageType) {
    case "course_home":
      return [
        "What should I focus on in this course this week?",
        "What risks should I watch?"
      ];
    case "assignment":
      return [
        "Summarize this assignment",
        "What could I miss before submitting?"
      ];
    case "module":
      return [
        "What do I need to complete in this module first?",
        "Are there hidden prerequisites here?"
      ];
    case "syllabus":
      return [
        "What are the most important course rules here?",
        "Summarize the grading and attendance policy."
      ];
    case "files":
      return [
        "Which files here are likely important?",
        "What should I organize or download from this page?"
      ];
    case "grades":
      return [
        "What is my current standing in this course?",
        "What upcoming work matters most for my grade?"
      ];
    case "dashboard":
      return [
        "What should I do first across my courses?",
        "What is my nearest risk right now?"
      ];
    default:
      return [
        "What matters on this page?",
        "What should I do next?"
      ];
  }
}

function alertsForContext(context: CanvasPageContext): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (context.rubricDetected) {
    alerts.push({
      id: "rubric",
      severity: "low",
      title: "Rubric detected",
      detail: "Review the rubric before submitting so you do not miss grading criteria."
    });
  }

  if (context.fileRestrictionsDetected) {
    alerts.push({
      id: "files",
      severity: "medium",
      title: "Possible file restrictions",
      detail: "This page suggests allowed file type requirements. Double-check before upload."
    });
  }

  if (context.peerReviewDetected) {
    alerts.push({
      id: "peer-review",
      severity: "medium",
      title: "Peer review detected",
      detail: "This assignment may include a peer review step after submission."
    });
  }

  if (context.modulePrerequisiteDetected || context.mustViewDetected) {
    alerts.push({
      id: "module-prereq",
      severity: "medium",
      title: "Module requirements may block progress",
      detail: "Look for must-view, unlock, or prerequisite requirements before moving on."
    });
  }

  if (context.latePolicyText) {
    alerts.push({
      id: "late-policy",
      severity: "low",
      title: "Late policy mentioned",
      detail: context.latePolicyText
    });
  }

  return alerts;
}

function checklistForContext(context: CanvasPageContext): ChecklistItem[] {
  switch (context.pageType) {
    case "course_home":
      return [
        { id: "course-focus", label: "Identify the next major deadline for this course" },
        { id: "course-risk", label: "Check whether attendance, exams, or grading rules create immediate risk" },
        { id: "course-next", label: "Choose one concrete next action for this course today" }
      ];
    case "assignment":
      return [
        { id: "assignment-due", label: "Confirm due date and submission time" },
        { id: "assignment-submit", label: "Verify submission type and allowed files" },
        { id: "assignment-rubric", label: "Review rubric and hidden requirements before submitting" }
      ];
    case "module":
      return [
        { id: "module-read", label: "Read all module items in order" },
        { id: "module-unlock", label: "Confirm unlock conditions or prerequisites" },
        { id: "module-links", label: "Check downstream assignment or quiz links" }
      ];
    case "syllabus":
      return [
        { id: "syllabus-attendance", label: "Check attendance policy" },
        { id: "syllabus-grading", label: "Check grading weights" },
        { id: "syllabus-exams", label: "Check exam dates and late policy" }
      ];
    case "files":
      return [
        { id: "files-important", label: "Identify the important file or folder on this page" },
        { id: "files-rename", label: "Note which materials should be organized in the full web app" },
        { id: "files-check", label: "Check whether this folder contains assignment or study-critical materials" }
      ];
    case "grades":
      return [
        { id: "grades-current", label: "Check current percent and current letter grade" },
        { id: "grades-risk", label: "Identify the next assignment that can change this grade" },
        { id: "grades-next", label: "Decide whether you need the full web app for deeper grade planning" }
      ];
    case "dashboard":
      return [
        { id: "dash-nearest", label: "Identify the nearest due item across courses" },
        { id: "dash-risk", label: "Look for the course with the highest current pressure" },
        { id: "dash-open", label: "Open the full web app if you need deeper planning" }
      ];
    default:
      return [
        { id: "generic-context", label: "Confirm what this page is asking you to do" },
        { id: "generic-risk", label: "Check for hidden requirements or blockers" },
        { id: "generic-next", label: "Choose the next concrete action" }
      ];
  }
}

function pageSummaryForContext(context: CanvasPageContext) {
  switch (context.pageType) {
    case "course_home":
      return `You are on the course home page${context.courseName ? ` for ${context.courseName}` : ""}. Focus on current pressure and the next critical task, not full-semester planning.`;
    case "assignment":
      return `You are on an assignment page${context.courseName ? ` for ${context.courseName}` : ""}. Prioritize due date, submission type, rubric, and hidden requirements before submitting.`;
    case "module":
      return "You are on a module page. Watch for unlock rules, must-view steps, and downstream assignments or quizzes.";
    case "syllabus":
      return "You are on the syllabus page. Extract the high-level course rules: attendance, grading weights, exams, and late policy.";
    case "files":
      return "You are on a files page. Focus on the current folder context and whether these materials are important for assignments or study.";
    case "grades":
      return "You are on the grades page. Focus on the current percent, current letter grade, and the next graded work that matters.";
    case "dashboard":
      return "You are on the Canvas dashboard. Focus on cross-course risk, nearest due item, and whether you should jump into the full web app.";
    default:
      return "You are on a Canvas page. Focus on what matters on this page right now.";
  }
}

export function buildFallbackSummary(
  context: CanvasPageContext,
  courseSnapshot?: CanvasCourseSnapshot,
  assignmentSnapshot?: CanvasAssignmentSnapshot,
  gradeSnapshot?: CanvasGradeSnapshot,
  dataSource: SummaryDataSource = "dom_fallback"
): ContextSummaryResponse {
  const alerts = alertsForContext(context);
  const checklist = checklistForContext(context);

  return {
    riskLevel:
      context.pageType === "assignment" || alerts.some((item) => item.severity !== "low")
        ? "medium"
        : "low",
    pageSummary: pageSummaryForContext(context),
    alerts,
    checklist,
    promptSuggestions: promptsForPage(context.pageType),
    dataSource,
    cardSources: {
      snapshot:
        dataSource === "canvas_api" && (courseSnapshot || assignmentSnapshot || gradeSnapshot)
          ? "canvas_api"
          : "dom_fallback",
      risk: "dom_fallback",
      checklist: "dom_fallback"
    },
    courseSnapshot:
      courseSnapshot ??
      (context.courseName || context.courseCode
        ? {
            courseId: context.courseId,
            courseName: context.courseName,
            courseCode: context.courseCode,
            currentPressure: context.nearestDueText
          }
        : undefined),
    assignmentSnapshot:
      context.pageType === "assignment"
        ? assignmentSnapshot ?? {
            assignmentId: context.assignmentId,
            name: context.pageTitle,
            dueAt: context.detectedDueText ?? null,
            submissionTypes: context.detectedSubmissionTypeText
              ? [context.detectedSubmissionTypeText]
              : undefined,
            hasRubric: context.rubricDetected
          }
        : undefined,
    gradeSnapshot:
      context.pageType === "grades"
        ? gradeSnapshot ?? {
            currentPercent: undefined,
            currentLetterGrade: undefined
          }
        : undefined,
    context
  };
}

export async function fetchContextSummary(
  settings: ExtensionSettings,
  payload: SummaryPayload
): Promise<ContextSummaryResponse | null> {
  try {
    const response = await fetch(`${resolveBackendBaseUrl(settings)}/extension/context-summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    return (await response.json()) as ContextSummaryResponse;
  } catch {
    return null;
  }
}

export async function askAgent(
  settings: ExtensionSettings,
  request: AskAgentRequest
): Promise<AskAgentResponse> {
  try {
    const response = await fetch(`${resolveBackendBaseUrl(settings)}/extension/ask-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Backend request failed: ${response.status}`);
    }

    return (await response.json()) as AskAgentResponse;
  } catch {
    return {
      answer:
        "Backend unavailable, so this is a local fallback. Focus on the current page, check hidden requirements, and complete the top checklist items before moving on.",
      followups: promptsForPage(request.context.pageType)
    };
  }
}
