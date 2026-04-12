import type { ChecklistItem, ContextSummaryResponse } from "../lib/types/api";

export type WidgetKind =
  | "dashboard_deadlines"
  | "course_snapshot"
  | "assignment_snapshot"
  | "module_summary"
  | "syllabus_rules"
  | "files_context"
  | "grade_snapshot"
  | "risk_alerts"
  | "checklist";

export interface WidgetPlanItem {
  kind: WidgetKind;
  priority: number;
}

export interface SignalProfile {
  pageType: ContextSummaryResponse["context"]["pageType"];
}

export function deriveSignals(summary: ContextSummaryResponse): SignalProfile {
  return {
    pageType: summary.context.pageType
  };
}

export function derivePromptSuggestions(summary: ContextSummaryResponse) {
  switch (summary.context.pageType) {
    case "course_home":
      return [
        "What should I focus on in this course this week?",
        "What risk should I watch first?"
      ];
    case "assignment":
      return [
        "Summarize this assignment",
        "What could I miss before submitting?"
      ];
    case "module":
      return [
        "What do I need to finish in this module first?",
        "What will I likely learn next?"
      ];
    case "syllabus":
      return [
        "What are the most important course rules here?",
        "Summarize grading and attendance policy."
      ];
    case "files":
      return [
        "What matters in this folder?",
        "What file-related reminder should I keep in mind?"
      ];
    case "grades":
      return [
        "What is my current standing in this course?",
        "What upcoming work matters most for my grade?"
      ];
    case "dashboard":
      return [
        "What should I do first across my courses?",
        "What are my nearest deadlines?"
      ];
    default:
      return summary.promptSuggestions.slice(0, 2);
  }
}

export function deriveChecklistTitle(summary: ContextSummaryResponse) {
  switch (summary.context.pageType) {
    case "assignment":
      return "Pre-submit checklist";
    case "files":
      return "File reminders";
    case "grades":
      return "Grade checklist";
    default:
      return "Quick checklist";
  }
}

export function deriveVisibleChecklist(summary: ContextSummaryResponse): ChecklistItem[] {
  if (summary.context.pageType === "dashboard" || summary.context.pageType === "module") {
    return [];
  }

  return summary.checklist.slice(0, 3);
}

export function deriveWidgetPlan(summary: ContextSummaryResponse) {
  switch (summary.context.pageType) {
    case "course_home":
      return [
        { kind: "course_snapshot", priority: 100 },
        { kind: "risk_alerts", priority: 90 },
        { kind: "checklist", priority: 80 }
      ] satisfies WidgetPlanItem[];
    case "assignment":
      return [
        { kind: "assignment_snapshot", priority: 100 },
        { kind: "risk_alerts", priority: 90 },
        { kind: "checklist", priority: 80 }
      ] satisfies WidgetPlanItem[];
    case "module":
      return [
        { kind: "module_summary", priority: 100 }
      ] satisfies WidgetPlanItem[];
    case "syllabus":
      return [
        { kind: "course_snapshot", priority: 100 },
        { kind: "syllabus_rules", priority: 90 },
        { kind: "checklist", priority: 80 }
      ] satisfies WidgetPlanItem[];
    case "files":
      return [
        { kind: "files_context", priority: 100 },
        { kind: "checklist", priority: 80 }
      ] satisfies WidgetPlanItem[];
    case "grades":
      return [
        { kind: "grade_snapshot", priority: 100 },
        { kind: "checklist", priority: 80 }
      ] satisfies WidgetPlanItem[];
    case "dashboard":
      return [] satisfies WidgetPlanItem[];
    default:
      return [
        { kind: "course_snapshot", priority: 100 },
        { kind: "risk_alerts", priority: 80 }
      ] satisfies WidgetPlanItem[];
  }
}
