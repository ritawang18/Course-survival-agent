import type {
  CanvasAssignmentSnapshot,
  CanvasCourseSnapshot,
  CanvasGradeSnapshot,
  CanvasPageContext
} from "./canvas";

export interface RiskAlert {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed?: boolean;
}

export type SummaryDataSource = "database" | "canvas_api" | "dom_fallback";

export interface CardDataSources {
  snapshot: SummaryDataSource;
  risk: SummaryDataSource;
  checklist: SummaryDataSource;
}

export interface ExtensionCourseMatch {
  courseUuid: string;
  courseCode?: string;
  courseName?: string | null;
  matchSource: "canvas_mapping" | "text_match";
}

export interface ExtensionWeeklyPulseSummary {
  generatedAt?: string | null;
  pastWeekLearned: string;
  nextWeekPreview: string;
}

export interface ContextSummaryResponse {
  riskLevel: "low" | "medium" | "high";
  pageSummary: string;
  alerts: RiskAlert[];
  checklist: ChecklistItem[];
  promptSuggestions: string[];
  dataSource: SummaryDataSource;
  cardSources: CardDataSources;
  courseSnapshot?: CanvasCourseSnapshot;
  assignmentSnapshot?: CanvasAssignmentSnapshot;
  gradeSnapshot?: CanvasGradeSnapshot;
  courseMatch?: ExtensionCourseMatch;
  weeklyPulse?: ExtensionWeeklyPulseSummary;
  context: CanvasPageContext;
}

export interface AskAgentRequest {
  context: CanvasPageContext;
  question: string;
}

export interface AskAgentResponse {
  answer: string;
  followups?: string[];
}
