// planner-tools.ts wraps lib/scheduler.ts (the AI study-plan generator) for the agent

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { getCalendarClient } from "@/lib/calendar-auth";
import { getFreeBusy } from "@/lib/google-calendar";
import { requireAIConfig } from "@/lib/ai/client";
import {
  generateStudyPlan,
  persistStudyPlan,
  type SchedulerAssignment,
  type SchedulerExam,
  type SchedulerCourse,
} from "@/lib/scheduler";
import type { AgentContext, ToolDefinition } from "@/lib/agent/types";
import type { Difficulty } from "@/lib/store/types";
import { priorityFromDueDate } from "@/lib/utils/priority";

export const generateStudyPlanTool: ToolDefinition<
  { courseId?: string; horizonDays?: number },
  {
    generated: boolean;
    reasoning?: string;
    warnings?: string[];
    blocks?: {
      title: string;
      courseName: string;
      date: string;
      start: string;
      end: string;
      priority?: string;
      difficulty?: string;
      conflict: boolean;
    }[];
    message?: string;
  }
> = {
  name: "generate_study_plan",
  description:
    "Generate and save a study schedule for the user's upcoming assignments and exams, fit into their free time from Google Calendar. Returns the generated blocks (title, course, date, start/end time) and the scheduler's reasoning — relay these back to the user (e.g. 'Study calculus from 7:00-8:00, then work on your systems assignment from 8:15-9:30') rather than just confirming it saved. Optionally scope to one course by UUID. Requires the user to have connected Google Calendar.",
  inputSchema: z.object({
    courseId: z.string().uuid().optional(),
    horizonDays: z.number().int().min(1).max(30).optional().default(7),
  }),
  execute: async (args, ctx: AgentContext) => {
    const horizonDays = args.horizonDays ?? 7;
    const supabase = getServiceClient();

    let courseQuery = supabase
      .from("courses")
      .select("id, course_id, course_name, schedule")
      .eq("user_id", ctx.userId);
    if (args.courseId) courseQuery = courseQuery.eq("id", args.courseId);

    const { data: courseRows, error: courseError } = await courseQuery;
    if (courseError) {
      throw new Error(`generate_study_plan course lookup failed: ${courseError.message}`);
    }
    if (!courseRows || courseRows.length === 0) {
      return { generated: false, message: "No courses found for this user." };
    }

    const courses: SchedulerCourse[] = courseRows.map((c) => ({
      id: c.course_id as string,
      uuid: c.id as string,
      code: c.course_id as string,
      name: c.course_name as string,
      schedule: (c.schedule as string | null) ?? "",
    }));
    const courseIdByUuid = new Map(courseRows.map((c) => [c.id as string, c.course_id as string]));
    const courseUuids = courseRows.map((c) => c.id as string);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("assignments")
      .select("id, course_id, title, assignment_type, due_at, estimated_hours, difficulty, topic, weight, status")
      .in("course_id", courseUuids)
      .neq("status", "done")
      .not("due_at", "is", null);

    if (assignmentError) {
      throw new Error(`generate_study_plan assignment lookup failed: ${assignmentError.message}`);
    }

    const assignments: SchedulerAssignment[] = [];
    const exams: SchedulerExam[] = [];

    for (const row of assignmentRows ?? []) {
      const courseId = courseIdByUuid.get(row.course_id as string);
      if (!courseId) continue;
      const dueAt = row.due_at as string;

      if (row.assignment_type === "exam") {
        exams.push({
          id: row.id as string,
          courseId,
          title: row.title as string,
          date: dueAt,
          weight: (row.weight as number | null) ?? 0,
          topics: row.topic ? [row.topic as string] : [],
        });
        continue;
      }

      assignments.push({
        id: row.id as string,
        courseId,
        title: row.title as string,
        dueDate: dueAt,
        estimatedHours: (row.estimated_hours as number | null) ?? 2,
        difficulty: (row.difficulty as Difficulty | null) ?? "medium",
        priority: priorityFromDueDate(dueAt),
        status: (row.status as SchedulerAssignment["status"]) ?? "not_started",
      });
    }

    if (assignments.length === 0 && exams.length === 0) {
      return { generated: false, message: "No upcoming assignments or exams to plan around." };
    }

    const auth = await getCalendarClient();
    if (!auth.ok) {
      return { generated: false, message: `Google Calendar isn't connected: ${auth.error}` };
    }

    const freeWindows = await getFreeBusy(auth.client, { days: horizonDays });
    const aiConfig = await requireAIConfig(ctx.userId);

    const result = await generateStudyPlan(
      { assignments, exams, courses, freeWindows, horizonDays },
      aiConfig
    );

    await persistStudyPlan(result, courses);

    const courseNameByCode = new Map(courses.map((c) => [c.id, c.name]));

    return {
      generated: true,
      reasoning: result.reasoning,
      warnings: result.warnings,
      blocks: result.studyBlocks.map((block) => ({
        title: block.title,
        courseName: courseNameByCode.get(block.course_id) ?? block.course_id,
        date: block.date,
        start: block.start,
        end: block.end,
        priority: block.priority,
        difficulty: block.difficulty,
        conflict: block.conflict ?? false,
      })),
    };
  },
  sideEffect: true, // writes study_plan + study_plan_blocks
};
