import { extractJSON } from "@/lib/claude";
import type { AIProvider } from "@/lib/ai/models";

export interface ParsedDeadline {
  label: string;
  date: string;       // ISO 8601
  confidence: number; // 0–1
}

export interface ParsedWeight {
  name: string;
  percent: number;
  confidence: number;
}

export interface ParsedExamDate {
  label: string;
  date: string;
  confidence: number;
}

export interface ParsedAttendancePolicy {
  text: string;
  maxAbsences: number | null;  // null if not stated
  penaltyPerAbsence: number | null; // percentage points, null if not stated
  confidence: number;
}

export interface ParsedCutoff {
  grade: string;        // "A", "A-", "B+", etc.
  minPercent: number;   // minimum percent to achieve this grade
  confidence: number;
}

export interface ParsedTopicOutlineWeek {
  label: string;
  topics: string[];
  dateRange: string | null;
  confidence: number;
}

export interface SyllabusParseResult {
  deadlines: ParsedDeadline[];
  weights: ParsedWeight[];
  examDates: ParsedExamDate[];
  cutoffs: ParsedCutoff[];
  topicOutline: ParsedTopicOutlineWeek[];
  attendancePolicy: ParsedAttendancePolicy;
  courseCode: string | null;
  courseName: string | null;
  instructor: string | null;
  gradingPolicy: string | null;
}

const SYSTEM_PROMPT = `You are an expert academic document parser. Your job is to extract structured information from course syllabi.

Return ONLY a JSON object — no prose, no markdown fences. Use this exact schema:

{
  "courseCode": "CS 61A" | null,
  "courseName": "Structure and Interpretation of Computer Programs" | null,
  "instructor": "Professor Name" | null,
  "deadlines": [
    { "label": "Homework 1", "date": "2026-02-10T23:59:00", "confidence": 0.95 }
  ],
  "weights": [
    { "name": "Homework", "percent": 20, "confidence": 0.98 }
  ],
  "examDates": [
    { "label": "Midterm 1", "date": "2026-03-05T18:00:00", "confidence": 0.9 }
  ],
  "cutoffs": [
    { "grade": "A", "minPercent": 93, "confidence": 0.98 },
    { "grade": "A-", "minPercent": 90, "confidence": 0.98 }
  ],
  "topicOutline": [
    {
      "label": "Week 1",
      "topics": ["Introduction to regression", "Linear models"],
      "dateRange": "Aug 26-Aug 30",
      "confidence": 0.84
    }
  ],
  "attendancePolicy": {
    "text": "You may miss up to 3 lectures without penalty.",
    "maxAbsences": 3,
    "penaltyPerAbsence": null,
    "confidence": 0.85
  },
  "gradingPolicy": "The lowest quiz score will be dropped. The final exam can replace a lower midterm score. Late homework receives 50% credit." | null
}

Rules:
- All dates in ISO 8601. If no time specified, use 23:59:00 for deadlines and 00:00:00 for exams.
- Weights must sum to 100 across all categories. If the syllabus gives a partial breakdown, include only what's stated.
- cutoffs: extract grade cutoff table if present (e.g. "A: 93-100%", "B+: 87-89%"). Use the lower bound as minPercent.
- topicOutline: extract weekly, unit, module, or schedule-outline sections when present. Each item should name the week/unit/module and list the main concepts or topics. Use [] if the syllabus does not provide a week-by-week or unit-by-unit outline.
- confidence: 0.9+ = explicit in text, 0.7–0.89 = inferred, <0.7 = guessed.
- gradingPolicy: extract any special grading rules verbatim from the syllabus (e.g. "lowest quiz dropped", "final replaces midterm if higher", "late penalty 10% per day"). Combine all such rules into a single string separated by ". ". null if no special rules found.
- If a field has no information, use an empty array [] or null.
- Do NOT invent data. Only extract what is actually in the document.`;

export async function parseSyllabus(
  text: string,
  options?: { provider?: AIProvider; apiKey?: string; model?: string }
): Promise<SyllabusParseResult> {
  const truncated = text.slice(0, 12000); // Claude context guard
  return extractJSON<SyllabusParseResult>(
    SYSTEM_PROMPT,
    `Parse this syllabus:\n\n${truncated}`,
    options
  );
}
