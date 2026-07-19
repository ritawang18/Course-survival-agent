import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/supabase/server";
import { requireAIConfig } from "@/lib/ai/client";
import { generateDashboardWeeklyOverview } from "@/lib/skills/generateDashboardWeeklyOverview";

export const runtime = "nodejs";

const MinimalCoursePulseSchema = z.object({
  pulse: z.object({
    pastWeekLearned: z.string(),
    nextWeekPreview: z.string(),
    confidence: z.number(),
  }),
}).passthrough();

const RequestSchema = z.object({
  courses: z.array(
    z.object({
      id: z.string(),
      code: z.string().optional(),
      name: z.string().optional(),
      course_id: z.string().optional(),
      course_name: z.string().optional(),
      current_grade_percent: z.number().optional(),
      weeklyPulse: MinimalCoursePulseSchema.optional(),
    })
  ),
  assignments: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      due_at: z.string().optional(),
      status: z.string().optional(),
      assignment_type: z.string().optional(),
    })
  ),
  exams: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      date: z.string(),
      weight: z.number().optional(),
    })
  ),
  studyBlocks: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      date: z.string(),
      start: z.string(),
      end: z.string(),
      type: z.string(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = RequestSchema.parse(await request.json());
    const aiConfig = await requireAIConfig(user.id);

    const overview = await generateDashboardWeeklyOverview(body, aiConfig);

    return NextResponse.json({ ok: true, overview });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate dashboard overview." },
      { status: 500 }
    );
  }
}
