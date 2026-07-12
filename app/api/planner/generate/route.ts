import { NextRequest, NextResponse } from "next/server";
import { generateStudyPlan, persistStudyPlan, SchedulerInput } from "@/lib/scheduler";
import { getUserFromRequest } from "@/lib/supabase/server";
import { requireAIConfig } from "@/lib/ai/client";

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

    await persistStudyPlan(result, body.courses);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[planner/generate]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
