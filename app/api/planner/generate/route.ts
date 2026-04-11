import { NextRequest, NextResponse } from "next/server";
import { generateStudyPlan, SchedulerInput } from "@/lib/scheduler";

export const runtime = "nodejs";

/**
 * POST /api/planner/generate
 *
 * Body: SchedulerInput
 * {
 *   assignments: [...],
 *   exams: [...],
 *   courses: [...],
 *   freeWindows: [...],   // from /api/calendar/freebusy, or computed client-side
 *   horizonDays?: 7
 * }
 *
 * Response: SchedulerOutput
 * {
 *   studyBlocks: StudyBlock[],
 *   reasoning: string,
 *   warnings: string[]
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SchedulerInput;

    const { assignments, exams, courses, freeWindows } = body;

    if (!Array.isArray(assignments) || !Array.isArray(exams) || !Array.isArray(freeWindows)) {
      return NextResponse.json(
        { error: "assignments, exams, and freeWindows arrays are required" },
        { status: 400 }
      );
    }

    const result = await generateStudyPlan(body);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[planner/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
