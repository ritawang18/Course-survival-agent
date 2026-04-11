import { extractJSON } from "@/lib/claude";
import type { StudyBlock, Priority, Difficulty } from "@/lib/store/types";

// ── Input types ──────────────────────────────────────────────────────────────

export interface SchedulerAssignment {
  id: string;
  courseId: string;
  title: string;
  dueDate: string;       // ISO
  estimatedHours: number;
  difficulty: Difficulty;
  priority: Priority;
  status: "not_started" | "in_progress" | "done" | "overdue";
}

export interface SchedulerExam {
  id: string;
  courseId: string;
  title: string;
  date: string;          // ISO
  weight: number;        // % of final grade
  topics: string[];
}

export interface SchedulerCourse {
  id: string;
  code: string;
  name: string;
  schedule: string;      // e.g. "MWF 10:00–11:00"
}

export interface FreeWindow {
  date: string;          // YYYY-MM-DD
  slots: { start: string; end: string }[]; // HH:mm
}

export interface SchedulerInput {
  assignments: SchedulerAssignment[];
  exams: SchedulerExam[];
  courses: SchedulerCourse[];
  freeWindows: FreeWindow[];
  horizonDays?: number;  // how many days to plan (default 7)
}

// ── Output type ───────────────────────────────────────────────────────────────

// Extends the app's StudyBlock with a generated id
type GeneratedBlock = Omit<StudyBlock, "id"> & { id: string };

export interface SchedulerOutput {
  studyBlocks: GeneratedBlock[];
  reasoning: string;       // short explanation of the plan strategy
  warnings: string[];      // conflicts or constraints that couldn't be satisfied
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert academic study planner. Your job is to generate an optimal, realistic study schedule for a student.

Given:
- A list of assignments with due dates, estimated hours, and difficulty
- Upcoming exams with dates and weights
- Courses with their recurring class times
- Free time windows in the student's calendar

Generate a study schedule as an array of study blocks. Return ONLY valid JSON in this exact shape:

{
  "studyBlocks": [
    {
      "id": "gen-1",
      "courseId": "course-id",
      "title": "CS 61A – Review recursion",
      "date": "2026-04-14",
      "start": "14:00",
      "end": "16:00",
      "type": "study",
      "difficulty": "hard",
      "priority": "urgent",
      "conflict": false
    }
  ],
  "reasoning": "Prioritized CS 61A midterm prep (35% of grade) in the 3 days before exam. Distributed ECON homework across Monday/Tuesday free windows.",
  "warnings": ["Thursday has no free windows — MATH HW may need to be moved"]
}

Scheduling rules:
1. URGENT = due within 3 days or exam within 3 days. Always schedule these first.
2. IMPORTANT = due within 7 days or exam within 7 days.
3. OPTIONAL = anything else.
4. Never place a study block outside the provided free windows.
5. Respect minimum break time: no back-to-back blocks longer than 3h without a gap.
6. Harder assignments get morning/earlier slots (peak focus time).
7. Spread exam review across multiple days — spaced repetition.
8. Each block should be 1–2 hours. Break longer sessions into multiple blocks.
9. If a free window is too short for a needed block, set conflict: true and place it anyway.
10. Do NOT include class, exam, or office_hours blocks — only type: "study".

Return ONLY the JSON object. No prose, no markdown fences.`;

// ── Main function ─────────────────────────────────────────────────────────────

export async function generateStudyPlan(
  input: SchedulerInput
): Promise<SchedulerOutput> {
  const horizon = input.horizonDays ?? 7;

  // Filter to only relevant assignments (not done, within horizon + buffer)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + horizon + 3);

  const relevantAssignments = input.assignments.filter(
    (a) => a.status !== "done" && new Date(a.dueDate) <= cutoff
  );

  const relevantExams = input.exams.filter(
    (e) => new Date(e.date) <= cutoff
  );

  const userContent = JSON.stringify(
    {
      today: new Date().toISOString().slice(0, 10),
      horizonDays: horizon,
      assignments: relevantAssignments,
      exams: relevantExams,
      courses: input.courses,
      freeWindows: input.freeWindows,
    },
    null,
    2
  );

  const result = await extractJSON<SchedulerOutput>(SYSTEM_PROMPT, userContent);

  // Ensure all blocks have unique ids
  result.studyBlocks = result.studyBlocks.map((b, i) => ({
    ...b,
    id: b.id || `gen-${Date.now()}-${i}`,
  }));

  return result;
}
