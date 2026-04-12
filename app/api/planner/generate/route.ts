import { NextRequest, NextResponse } from "next/server";
import { generateStudyPlan, SchedulerInput } from "@/lib/scheduler";
import { getUserFromRequest } from "@/lib/supabase/server";
import { upsertStudyPlan } from "@/lib/db/study_plan";
import { requireAIConfig } from "@/lib/ai/client";
import { replaceStudyPlanBlocks } from "@/lib/db/study_plan_blocks";

export const runtime = "nodejs";

/**
 * POST /api/planner/generate
 *
 * Body: SchedulerInput (courses must include a `uuid` field matching courses.id in DB)
 * {
 *   assignments: [...],
 *   exams: [...],
 *   courses: [{ id, uuid, code, name, schedule }],
 *   freeWindows: [...],
 *   horizonDays?: 7
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as SchedulerInput;
    const aiConfig = await requireAIConfig(user.id);

    const { assignments, exams, freeWindows } = body;

    if (!Array.isArray(assignments) || !Array.isArray(exams) || !Array.isArray(freeWindows)) {
      return NextResponse.json(
        { error: "assignments, exams, and freeWindows arrays are required" },
        { status: 400 }
      );
    }

    const result = await generateStudyPlan(body, {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
    });

    // ── Persist to study_plan (one row per course, most urgent block wins) ────
    const courseUuidMap = Object.fromEntries(
      body.courses
        .filter((c) => c.uuid)
        .map((c) => [c.id, c.uuid!])
    );

    // Group blocks by courseId, pick the highest-priority block per course
    const priorityRank: Record<string, number> = { urgent: 3, important: 2, optional: 1 };
    const perCourse = new Map<string, typeof result.studyBlocks[number]>();

    for (const block of result.studyBlocks) {
      const existing = perCourse.get(block.course_id);
      const blockRank = block.priority ? (priorityRank[block.priority] ?? 0) : 0;
      const existingRank = existing?.priority ? (priorityRank[existing.priority] ?? 0) : -1;
      if (blockRank > existingRank) perCourse.set(block.course_id, block);
    }

    const planRows = [...perCourse.entries()]
      .filter(([courseId]) => courseUuidMap[courseId])
      .map(([courseId, block]) => ({
        courseUuid: courseUuidMap[courseId],
        courseId,
        title: block.title,
        type: block.type as string,
        priority: block.priority ?? "optional",
        difficulty: block.difficulty ?? "medium",
      }));

    const blockRows = result.studyBlocks
      .filter((block) => courseUuidMap[block.course_id])
      .map((block) => ({
        courseUuid: courseUuidMap[block.course_id],
        courseId: block.course_id,
        title: block.title,
        date: block.date,
        start: block.start,
        end: block.end,
        type: block.type,
        priority: block.priority ?? null,
        difficulty: block.difficulty ?? null,
        conflict: block.conflict ?? false,
      }));

    if (planRows.length > 0) {
      await upsertStudyPlan(planRows);
    }

    await replaceStudyPlanBlocks(
      Object.values(courseUuidMap),
      blockRows
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[planner/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
