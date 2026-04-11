import type { InstructorInsight } from "@/lib/schemas/insight";

export type CourseColor = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";

export type AssignmentStatus = "not_started" | "in_progress" | "done" | "overdue";
export type Priority = "urgent" | "important" | "optional";
export type Difficulty = "easy" | "medium" | "hard";

export interface GradingCategory {
  id: string;
  name: string;
  weight: number;   // percent
  earned?: number;  // percent score so far
}

export interface LectureModule {
  id: string;
  title: string;
  week: number;
  status: "upcoming" | "done" | "in_progress";
  resources: number;
}

export interface UploadedFile {
  id: string;
  name: string;
  uploadedAt: string;
  kind: "syllabus" | "notes" | "assignment";
  pages: number;
}

export interface AttendancePolicy {
  attendance_allowed_misses: number;
  penaltyPerAbsence: number;
  note: string;
}

export interface Course {
  id: string;
  // ── UI-facing fields (legacy / optional after rita merge) ──
  code?: string;
  name?: string;
  instructor?: string;
  school?: string;
  color: CourseColor;
  // ── DB-aligned fields (canonical after rita merge) ──
  user_id?: string;
  course_id?: string;          // text course code, e.g. "CS344" — FK to syllabus
  course_name?: string;
  term?: string;
  instructor_name?: string;
  // ── shared ──
  credits: number;
  schedule: string;
  location?: string;
  current_grade_percent?: number;
  attendance_missed_count: number;
  attendance_allowed_misses: number;
  attendancePolicy?: AttendancePolicy;
  gradingWeights: GradingCategory[];  // from syllabus.break_down
  files: UploadedFile[];
  modules: LectureModule[];
  aiSummary: string;
  officeHourQuestions: string[];
  mockExamQuestions: { q: string; a: string }[];
  dependencyNotes: { from: string; to: string; why: string }[];
}

export interface Assignment {
  id: string;
  course_id: string;
  canvas_assignment_id?: string;
  grade_component_id?: string;
  title: string;
  assignment_type: string;    // "exam" | "quiz" | "homework" | "lab" | "project" | "essay"
  description?: string;
  due_at?: string;            // ISO
  available_from?: string;
  available_until?: string;
  points_possible?: number;
  score_received?: number;
  status: AssignmentStatus;
  estimated_hours?: number;
  importance_score?: number;
  dependencies?: string[];
}

export interface Exam {
  id: string;
  course_id: string;
  title: string;
  date: string;
  location: string;
  weight: number;
  topics: string[];
}

export type StudyBlockType =
  | "study"
  | "class"
  | "exam"
  | "office_hours"
  | "deadline";

export interface StudyBlock {
  id: string;
  course_id: string;
  title: string;
  date: string;       // ISO date
  start: string;      // HH:mm
  end: string;        // HH:mm
  type: StudyBlockType;
  difficulty?: Difficulty;
  priority?: Priority;
  conflict?: boolean;
}

export interface UploadArtifact {
  id: string;
  fileName: string;
  kind: "syllabus" | "notes" | "assignment";
  status: "parsing" | "parsed" | "needs_review";
  uploadedAt: string;
  extracted: {
    deadlines: { label: string; date: string; confidence: number }[];
    weights: { name: string; percent: number; confidence: number }[];
    examDates: { label: string; date: string; confidence: number }[];
    cutoffs: { grade: string; minPercent: number; confidence: number }[];
    attendancePolicy: { text: string; confidence: number };
  };
}

export type {
  InstructorInsight,
  RmpInsight,
  RedditInsight,
  Sentiment,
} from "@/lib/schemas/insight";

export interface AppData {
  courses: Course[];
  assignments: Assignment[];
  exams: Exam[];
  studyBlocks: StudyBlock[];
  uploads: UploadArtifact[];
  insights: InstructorInsight[];
}
