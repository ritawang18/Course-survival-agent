import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
import { getWeeklyCoursePulse, upsertWeeklyCoursePulse } from "@/lib/db/weekly_course_pulse";
import {
  generateWeeklyCoursePulse,
  WeeklyCoursePulseError,
} from "@/lib/skills/generateWeeklyCoursePulse";
import { getUserIntegrationToken } from "@/lib/db/user_integration_tokens";
import { requireAIConfig } from "@/lib/ai/client";

export const runtime = "nodejs";

const RequestSchema = z.object({
  courseUuid: z.string().min(1),
  canvasCourseId: z.string().optional(),
  canvasBaseUrl: z.string().url().optional(),
  canvasAccessToken: z.string().min(1).optional(),
  referenceDate: z.string().optional(),
  forceRefresh: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", body.courseUuid)
      .eq("user_id", user.id)
      .maybeSingle();

    if (courseError) {
      return NextResponse.json(
        {
          error: `Course authorization lookup failed: ${courseError.message}`,
          reason: "database_lookup_failed",
        },
        { status: 500 }
      );
    }
    if (!course) {
      return NextResponse.json(
        { error: "Course not found", reason: "course_not_found" },
        { status: 404 }
      );
    }

    const storedCanvasToken = await getUserIntegrationToken(user.id, "canvas");
    let aiConfig;
    try {
      aiConfig = await requireAIConfig(user.id);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Missing AI config for weekly course pulse generation",
          reason: "missing_ai_config",
        },
        { status: 400 }
      );
    }

    const anchorDate =
      body.referenceDate && !Number.isNaN(new Date(body.referenceDate).getTime())
        ? body.referenceDate.slice(0, 10)
        : mostRecentFridayIso(new Date());

    if (!body.forceRefresh) {
      const cached = await getWeeklyCoursePulse(body.courseUuid, anchorDate);
      if (cached) {
        return NextResponse.json({ ok: true, cached: true, pulse: cached });
      }
    }

    const generated = await generateWeeklyCoursePulse({
      courseUuid: body.courseUuid,
      canvasCourseId: body.canvasCourseId,
      canvasBaseUrl: body.canvasBaseUrl,
      canvasAccessToken: body.canvasAccessToken ?? storedCanvasToken ?? undefined,
      referenceDate: body.referenceDate,
      aiConfig,
    });

    const saved = await upsertWeeklyCoursePulse(generated);
    return NextResponse.json({ ok: true, cached: false, pulse: saved });
  } catch (err) {
    console.error("[weekly-course-pulse/generate]", err);
    if (err instanceof WeeklyCoursePulseError) {
      const statusByReason: Record<WeeklyCoursePulseError["reason"], number> = {
        course_not_found: 404,
        database_lookup_failed: 500,
        canvas_enrichment_unavailable: 502,
        llm_generation_failed: 502,
        invalid_reference_date: 400,
      };

      return NextResponse.json(
        { error: err.message, reason: err.reason },
        { status: statusByReason[err.reason] }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message, reason: "internal" },
      { status: 500 }
    );
  }
}

function mostRecentFridayIso(input: Date) {
  const next = new Date(input);
  const distance = (next.getDay() + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next.toISOString().slice(0, 10);
}
