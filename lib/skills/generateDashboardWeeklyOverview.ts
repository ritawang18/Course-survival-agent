/**
 * Dashboard Weekly Overview
 *
 * Cross-course, semester-level summary of the student's past week and
 * upcoming week — distinct from lib/skills/generateWeeklyCoursePulse.ts,
 * which is per-course. No DB table backs this; callers cache the result
 * however they like (the web app keeps it in client-side store state).
 */

import { formatISO } from "date-fns";
import type { AIConfig } from "@/lib/ai/client";
import { generateObjectWithAI } from "@/lib/ai/client";
import { DashboardWeeklyOverviewSchema, type DashboardWeeklyOverview } from "@/lib/schemas/dashboard-weekly-overview";

export interface DashboardOverviewCourse {
  id: string;
  code?: string;
  name?: string;
  course_id?: string;
  course_name?: string;
  current_grade_percent?: number;
  weeklyPulse?: {
    pulse: {
      pastWeekLearned: string;
      nextWeekPreview: string;
      confidence: number;
    };
  };
}

export interface DashboardOverviewAssignment {
  course_id: string;
  title: string;
  due_at?: string;
  status?: string;
  assignment_type?: string;
}

export interface DashboardOverviewExam {
  course_id: string;
  title: string;
  date: string;
  weight?: number;
}

export interface DashboardOverviewStudyBlock {
  course_id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  type: string;
}

export interface DashboardOverviewInput {
  courses: DashboardOverviewCourse[];
  assignments: DashboardOverviewAssignment[];
  exams: DashboardOverviewExam[];
  studyBlocks: DashboardOverviewStudyBlock[];
}

function toMostRecentFriday(input: Date) {
  const next = new Date(input);
  const day = next.getDay();
  const distance = (day + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next;
}

const SYSTEM_PROMPT =
  "You generate a dashboard-wide weekly overview for a student support system. " +
  "This is cross-course and semester-level, not course-specific. " +
  "Summarize the student's overall past week and overall next week across all courses. " +
  "Ground everything in the provided data only. Prefer course-specific weeklyPulse data when available, then assignments, exams, and study blocks. " +
  "Return concise, practical, student-facing prose. " +
  "Return only strict JSON.";

export async function generateDashboardWeeklyOverview(
  input: DashboardOverviewInput,
  aiConfig: AIConfig
): Promise<DashboardWeeklyOverview> {
  const anchorDate = formatISO(toMostRecentFriday(new Date()), { representation: "date" });

  const result = await generateObjectWithAI({
    config: aiConfig,
    schema: DashboardWeeklyOverviewSchema.omit({
      anchorDate: true,
      generatedAt: true,
      model: true,
    }),
    maxOutputTokens: 3000,
    system: SYSTEM_PROMPT,
    prompt:
      "Return one JSON object with exactly these top-level keys: " +
      '"pastWeekOverview", "nextWeekOverview", "courseHighlights", "confidence".\n\n' +
      "courseHighlights should contain up to 4 notable course-specific items across the semester. " +
      "Each item must include courseId, label, and reason.\n\n" +
      "Required JSON shape example:\n" +
      JSON.stringify(
        {
          pastWeekOverview: "You mostly worked across two heavy courses and kept up with planned study time.",
          nextWeekOverview: "The next week is deadline-heavy, with one exam and two near-term assignments.",
          courseHighlights: [
            {
              courseId: "course-1",
              label: "Algorithms needs attention",
              reason: "Quiz and homework are both due soon.",
            },
          ],
          confidence: 0.7,
        },
        null,
        2
      ) +
      "\n\nCurrent dashboard context:\n" +
      JSON.stringify({
        anchorDate,
        ...input,
      }),
  });

  return {
    ...result.object,
    anchorDate,
    generatedAt: new Date().toISOString(),
    model: aiConfig.model,
  };
}
