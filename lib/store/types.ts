export type CourseColor = "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet";

export type AssignmentStatus = "not_started" | "in_progress" | "done" | "overdue";
export type Priority = "urgent" | "important" | "optional";
export type Difficulty = "easy" | "medium" | "hard";

export interface GradingCategory {
  id: string;
  name: string;
  weight: number; // percent
  earned?: number; // percent score so far
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
  maxAbsences: number;
  penaltyPerAbsence: number; // percentage points off grade
  note: string;
}

export interface Course {
  id: string;
  code: string;
  name: string;
  instructor: string;
  color: CourseColor;
  credits: number;
  schedule: string;
  room: string;
  currentGrade: number;
  gradingWeights: GradingCategory[];
  attendancePolicy: AttendancePolicy;
  missedClasses: number;
  files: UploadedFile[];
  modules: LectureModule[];
  aiSummary: string;
  officeHourQuestions: string[];
  mockExamQuestions: { q: string; a: string }[];
  dependencyNotes: { from: string; to: string; why: string }[];
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string; // ISO
  status: AssignmentStatus;
  priority: Priority;
  estimatedHours: number;
  dependencies: string[];
  weightCategoryId?: string;
  score?: number;
}

export interface Exam {
  id: string;
  courseId: string;
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
  courseId: string;
  title: string;
  date: string; // ISO date
  start: string; // HH:mm
  end: string; // HH:mm
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
    attendancePolicy: { text: string; confidence: number };
  };
}

export interface InstructorInsight {
  courseId: string;
  rmp: {
    score: number;
    sentiment: "positive" | "mixed" | "negative";
    summary: string;
    quotes: string[];
    tags: string[];
  };
  reddit: {
    sentiment: "positive" | "mixed" | "negative";
    summary: string;
    quotes: string[];
    tags: string[];
  };
}

export interface AppData {
  courses: Course[];
  assignments: Assignment[];
  exams: Exam[];
  studyBlocks: StudyBlock[];
  uploads: UploadArtifact[];
  insights: InstructorInsight[];
}
