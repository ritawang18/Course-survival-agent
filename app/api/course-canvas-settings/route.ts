import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient, getUserFromRequest } from "@/lib/supabase/server";
import {
  getCourseCanvasSettings,
  upsertCourseCanvasSettings,
} from "@/lib/db/course_canvas_settings";

export const runtime = "nodejs";

const RequestSchema = z.object({
  courseUuid: z.string().min(1),
  canvasCourseId: z.string().trim().min(1).nullable().optional(),
  canvasBaseUrl: z
    .string()
    .trim()
    .url()
    .nullable()
    .optional()
    .transform((value) => value?.replace(/\/$/, "") ?? null),
});

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body" },
      { status: 400 }
    );
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
        { error: `Course lookup failed: ${courseError.message}` },
        { status: 500 }
      );
    }
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const saved = await upsertCourseCanvasSettings({
      courseUuid: body.courseUuid,
      canvasCourseId: body.canvasCourseId ?? null,
      canvasBaseUrl: body.canvasBaseUrl ?? null,
    });

    return NextResponse.json({
      ok: true,
      settings: {
        courseUuid: saved.course_uuid,
        canvasCourseId: saved.canvas_course_id,
        canvasBaseUrl: saved.canvas_base_url,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const courseUuid = url.searchParams.get("courseUuid");
  if (!courseUuid) {
    return NextResponse.json({ error: "courseUuid is required" }, { status: 400 });
  }

  try {
    const supabase = getServiceClient();
    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id")
      .eq("id", courseUuid)
      .eq("user_id", user.id)
      .maybeSingle();

    if (courseError) {
      return NextResponse.json(
        { error: `Course lookup failed: ${courseError.message}` },
        { status: 500 }
      );
    }
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const settings = await getCourseCanvasSettings(courseUuid);
    return NextResponse.json({
      ok: true,
      settings: settings
        ? {
            courseUuid: settings.course_uuid,
            canvasCourseId: settings.canvas_course_id,
            canvasBaseUrl: settings.canvas_base_url,
            updatedAt: settings.updated_at,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
