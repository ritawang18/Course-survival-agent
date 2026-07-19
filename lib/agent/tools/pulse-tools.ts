// pulse-tools.ts wraps lib/skills/generateWeeklyCoursePulse.ts (per-course) and
// lib/skills/generateDashboardWeeklyOverview.ts (cross-course) for the agent

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireAIConfig } from "@/lib/ai/client";
import {
  generateDashboardWeeklyOverview,
  type DashboardOverviewCourse,
  type DashboardOverviewExam,
} from "@/lib/skills/generateDashboardWeeklyOverview";
import {
  generateWeeklyCoursePulse,
  WeeklyCoursePulseError,
} from "@/lib/skills/generateWeeklyCoursePulse";
import { getWeeklyCoursePulse, upsertWeeklyCoursePulse } from "@/lib/db/weekly_course_pulse";
import { getUserIntegrationToken } from "@/lib/db/user_integration_tokens";
import type { AgentContext, ToolDefinition } from "@/lib/agent/types";

function mostRecentFridayIso(input: Date) {
  const next = new Date(input);
  const distance = (next.getDay() + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next.toISOString().slice(0, 10);
}

export const generateWeeklyPulseTool: ToolDefinition<
  { courseId: string; forceRefresh?: boolean },
  {
    generated: boolean;
    cached: boolean;
    message?: string;
    pastWeekLearned?: string;
    nextWeekPreview?: string;
    confidence?: number;
    generatedAt?: string;
  }
> = {
  name: "generate_weekly_pulse",
  description:
    "Generate (or return the cached) weekly pulse for a single course: what was covered last week and what's coming up next week, grounded in assignments, syllabus, and Canvas data when available. Use this for 'what happened in [course] this week' or 'what's next in [course]' — for a summary across ALL courses use generate_dashboard_weekly_overview instead.",
  inputSchema: z.object({
    courseId: z.string().uuid(),
    forceRefresh: z.boolean().optional().default(false),
  }),
  execute: async (args, ctx: AgentContext) => {
    const supabase = getServiceClient();

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", args.courseId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (courseError) {
      throw new Error(`generate_weekly_pulse course lookup failed: ${courseError.message}`);
    }
    if (!course) return { generated: false, cached: false, message: "Course not found." };

    const anchorDate = mostRecentFridayIso(new Date());

    if (!args.forceRefresh) {
      const cached = await getWeeklyCoursePulse(args.courseId, anchorDate);
      if (cached) {
        return {
          generated: true,
          cached: true,
          pastWeekLearned: cached.pulse.pastWeekLearned,
          nextWeekPreview: cached.pulse.nextWeekPreview,
          confidence: cached.pulse.confidence,
          generatedAt: cached.generatedAt,
        };
      }
    }

    const canvasToken = await getUserIntegrationToken(ctx.userId, "canvas");
    const aiConfig = await requireAIConfig(ctx.userId);

    try {
      const generated = await generateWeeklyCoursePulse({
        courseUuid: args.courseId,
        canvasAccessToken: canvasToken ?? undefined,
        aiConfig,
      });
      const saved = await upsertWeeklyCoursePulse(generated);

      return {
        generated: true,
        cached: false,
        pastWeekLearned: saved.pulse.pastWeekLearned,
        nextWeekPreview: saved.pulse.nextWeekPreview,
        confidence: saved.pulse.confidence,
        generatedAt: saved.generatedAt,
      };
    } catch (err) {
      if (err instanceof WeeklyCoursePulseError) {
        return { generated: false, cached: false, message: err.message };
      }
      throw err;
    }
  },
  sideEffect: true, // persists to weekly_course_pulse
};

export const generateDashboardWeeklyOverviewTool: ToolDefinition<
  Record<string, never>,
  {
    generated: boolean;
    message?: string;
    pastWeekOverview?: string;
    nextWeekOverview?: string;
    courseHighlights?: { courseId: string; label: string; reason: string }[];
    confidence?: number;
  }
> = {
  name: "generate_dashboard_weekly_overview",
  description:
    "Generate a cross-course, semester-level summary of the student's past week and upcoming week across ALL their courses — not course-specific. Use this for broad 'how's my week going' questions. For a single course's weekly summary, use the per-course weekly pulse instead.",
  inputSchema: z.object({}),
  execute: async (_args, ctx: AgentContext) => {
    const supabase = getServiceClient();

    const { data: courseRows, error: courseError } = await supabase
      .from("courses")
      .select("id, course_id, course_name, current_grade_percent")
      .eq("user_id", ctx.userId);

    if (courseError) {
      throw new Error(`generate_dashboard_weekly_overview course lookup failed: ${courseError.message}`);
    }
    if (!courseRows || courseRows.length === 0) {
      return { generated: false, message: "No courses found for this user." };
    }

    const courseUuids = courseRows.map((c) => c.id as string);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("assignments")
      .select("course_id, title, due_at, status, assignment_type")
      .in("course_id", courseUuids);

    if (assignmentError) {
      throw new Error(
        `generate_dashboard_weekly_overview assignment lookup failed: ${assignmentError.message}`
      );
    }

    const { data: blockRows, error: blockError } = await supabase
      .from("study_plan_blocks")
      .select("course_uuid, title, date, start_time, end_time, type")
      .in("course_uuid", courseUuids)
      .order("date", { ascending: true });

    if (blockError) {
      throw new Error(`generate_dashboard_weekly_overview study block lookup failed: ${blockError.message}`);
    }

    const { data: pulseRows, error: pulseError } = await supabase
      .from("weekly_course_pulse")
      .select("course_uuid, past_week_learned, next_week_preview, confidence, generated_at")
      .in("course_uuid", courseUuids)
      .order("generated_at", { ascending: false });

    if (pulseError) {
      throw new Error(`generate_dashboard_weekly_overview pulse lookup failed: ${pulseError.message}`);
    }

    // Most recent row per course wins (pulseRows is already ordered desc).
    const latestPulseByCourseUuid = new Map<string, (typeof pulseRows)[number]>();
    for (const row of pulseRows ?? []) {
      if (!latestPulseByCourseUuid.has(row.course_uuid as string)) {
        latestPulseByCourseUuid.set(row.course_uuid as string, row);
      }
    }

    const courses: DashboardOverviewCourse[] = courseRows.map((c) => {
      const pulse = latestPulseByCourseUuid.get(c.id as string);
      return {
        id: c.id as string,
        course_id: c.course_id as string,
        course_name: (c.course_name as string | null) ?? undefined,
        current_grade_percent: (c.current_grade_percent as number | null) ?? undefined,
        weeklyPulse: pulse
          ? {
              pulse: {
                pastWeekLearned: pulse.past_week_learned as string,
                nextWeekPreview: pulse.next_week_preview as string,
                confidence: (pulse.confidence as number | null) ?? 0,
              },
            }
          : undefined,
      };
    });

    const assignments = (assignmentRows ?? []).map((a) => ({
      course_id: a.course_id as string,
      title: a.title as string,
      due_at: (a.due_at as string | null) ?? undefined,
      status: (a.status as string | null) ?? undefined,
      assignment_type: (a.assignment_type as string | null) ?? undefined,
    }));

    // Exams aren't a separate table — treat assignment_type "exam" rows as
    // exams. Good enough context for a dashboard-level summary; the more
    // precise syllabus-exam-date derivation used elsewhere (app/api/me/data)
    // isn't needed at this level of granularity.
    const exams: DashboardOverviewExam[] = assignments
      .filter((a) => a.assignment_type === "exam" && a.due_at)
      .map((a) => ({ course_id: a.course_id, title: a.title, date: a.due_at! }));

    const studyBlocks = (blockRows ?? []).map((b) => ({
      course_id: b.course_uuid as string,
      title: b.title as string,
      date: b.date as string,
      start: (b.start_time as string).slice(0, 5),
      end: (b.end_time as string).slice(0, 5),
      type: b.type as string,
    }));

    const aiConfig = await requireAIConfig(ctx.userId);
    const overview = await generateDashboardWeeklyOverview(
      { courses, assignments, exams, studyBlocks },
      aiConfig
    );

    return {
      generated: true,
      pastWeekOverview: overview.pastWeekOverview,
      nextWeekOverview: overview.nextWeekOverview,
      courseHighlights: overview.courseHighlights,
      confidence: overview.confidence,
    };
  },
  sideEffect: false, // reads the DB and calls an LLM, but persists nothing
};
