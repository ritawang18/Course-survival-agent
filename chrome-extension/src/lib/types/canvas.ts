export type CanvasPageType =
  | "dashboard"
  | "course_home"
  | "assignment"
  | "module"
  | "syllabus"
  | "files"
  | "grades"
  | "unknown";

export interface CanvasPageContext {
  url: string;
  origin: string;
  pathname: string;
  pageType: CanvasPageType;
  courseId?: string;
  assignmentId?: string;
  moduleItemId?: string;
  courseName?: string;
  courseCode?: string;
  pageTitle?: string;
  detectedDueText?: string;
  detectedPointsText?: string;
  detectedSubmissionTypeText?: string;
  rubricDetected: boolean;
  fileRestrictionsDetected: boolean;
  peerReviewDetected: boolean;
  mustViewDetected: boolean;
  modulePrerequisiteDetected: boolean;
  latePolicyText?: string;
  attendancePolicyText?: string;
  gradingWeightsText?: string;
  examDatesText?: string;
  folderName?: string;
  nearestDueText?: string;
  dashboardDeadlines: string[];
  modulePastSummary?: string;
  moduleNextSummary?: string;
  rawDomHints: string[];
  detectedAt: string;
}

export interface CanvasCourseSnapshot {
  courseId?: string;
  courseName?: string;
  courseCode?: string;
  currentPressure?: string;
}

export interface CanvasAssignmentSnapshot {
  assignmentId?: string;
  name?: string;
  dueAt?: string | null;
  pointsPossible?: number | null;
  submissionTypes?: string[];
  hasRubric?: boolean;
  summary?: string;
}

export interface CanvasGradeSnapshot {
  currentPercent?: number | null;
  currentLetterGrade?: string | null;
}
