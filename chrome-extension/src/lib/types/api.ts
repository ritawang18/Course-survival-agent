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
