import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getUserFromRequest } from "@/lib/supabase/server";
import { getUserIntegrationToken } from "@/lib/db/user_integration_tokens";
import { listCourseCanvasSettings } from "@/lib/db/course_canvas_settings";
import { resolveAIConfig } from "@/lib/ai/client";
import { generateWeeklyCoursePulse } from "@/lib/skills/generateWeeklyCoursePulse";
import { upsertWeeklyCoursePulse } from "@/lib/db/weekly_course_pulse";

export const runtime = "nodejs";

const DUE_AFTER_DAYS = 6;

interface CourseRow {
  id: string;
  user_id: string;
  course_id: string;
  course_name: string | null;
}

interface LatestPulseRow {
  course_uuid: string;
  generated_at: string | null;
}

function isPulseDue(latestGeneratedAt: string | null) {
  if (!latestGeneratedAt) return true;
  const generated = new Date(latestGeneratedAt);
  if (Number.isNaN(generated.getTime())) return true;
  const elapsedMs = Date.now() - generated.getTime();
  return elapsedMs >= DUE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

async function runForCourses(courses: CourseRow[], forceRefresh: boolean) {
  const supabase = getServiceClient();
  const courseIds = courses.map((course) => course.id);
  const courseCanvasSettings = await listCourseCanvasSettings(courseIds);
  const canvasSettingsByCourse = new Map(
    courseCanvasSettings.map((row) => [row.course_uuid, row] as const)
  );

  const { data: pulseRows, error: pulseError } = await supabase
    .from("weekly_course_pulse")
    .select("course_uuid, generated_at")
    .in("course_uuid", courseIds)
    .order("generated_at", { ascending: false });

  if (pulseError) {
    throw new Error(`Weekly pulse schedule lookup failed: ${pulseError.message}`);
  }

  const latestPulseByCourse = new Map<string, LatestPulseRow>();
  for (const row of (pulseRows ?? []) as LatestPulseRow[]) {
    if (!latestPulseByCourse.has(row.course_uuid)) {
      latestPulseByCourse.set(row.course_uuid, row);
    }
  }

  const results: Array<{
    courseUuid: string;
    status: "generated" | "skipped" | "error";
    detail?: string;
  }> = [];

  for (const course of courses) {
    const latest = latestPulseByCourse.get(course.id);
    if (!forceRefresh && !isPulseDue(latest?.generated_at ?? null)) {
      results.push({
        courseUuid: course.id,
        status: "skipped",
        detail: "Pulse is still fresh.",
      });
      continue;
    }

    try {
      const aiConfig = await resolveAIConfig(course.user_id);
      if (!aiConfig) {
        results.push({
          courseUuid: course.id,
          status: "error",
          detail: "No AI config available for this user.",
        });
        continue;
      }

      const canvasAccessToken = await getUserIntegrationToken(course.user_id, "canvas");
      const courseCanvas = canvasSettingsByCourse.get(course.id);
      const generated = await generateWeeklyCoursePulse({
        courseUuid: course.id,
        canvasCourseId: courseCanvas?.canvas_course_id ?? undefined,
        canvasBaseUrl: courseCanvas?.canvas_base_url ?? undefined,
        canvasAccessToken: canvasAccessToken ?? undefined,
        referenceDate: mostRecentFridayIso(new Date()),
        aiConfig,
      });
      await upsertWeeklyCoursePulse(generated);

      results.push({
        courseUuid: course.id,
        status: "generated",
      });
    } catch (err) {
      results.push({
        courseUuid: course.id,
        status: "error",
        detail: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

function mostRecentFridayIso(input: Date) {
  const next = new Date(input);
  const distance = (next.getDay() + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next.toISOString().slice(0, 10);
}

async function handleRequest(req: NextRequest) {
  const url = new URL(req.url);
  const body =
    req.method === "POST"
      ? await req.json().catch(() => ({}))
      : {};

  const forceRefresh =
    body && typeof body.forceRefresh === "boolean"
      ? body.forceRefresh
      :
    url.searchParams.get("forceRefresh") === "true" ||
    url.searchParams.get("force") === "true";

  const cronSecret = process.env.WEEKLY_PULSE_CRON_SECRET;
  const cronAuthorized =
    !!cronSecret &&
    req.headers.get("x-weekly-pulse-cron-secret") === cronSecret;

  const user = await getUserFromRequest(req);
  if (!user && !cronAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const courseQuery = supabase
    .from("courses")
    .select("id, user_id, course_id, course_name")
    .order("created_at", { ascending: true });

  const scopedQuery =
    user && !cronAuthorized ? courseQuery.eq("user_id", user.id) : courseQuery;

  const { data: courses, error } = await scopedQuery;

  if (error) {
    return NextResponse.json(
      { error: `Failed to load courses: ${error.message}` },
      { status: 500 }
    );
  }

  const normalizedCourses = (courses ?? []) as CourseRow[];
  const results = await runForCourses(normalizedCourses, forceRefresh);

  return NextResponse.json({
    ok: true,
    mode: cronAuthorized && !user ? "cron" : "user",
    totalCourses: normalizedCourses.length,
    generated: results.filter((item) => item.status === "generated").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    errors: results.filter((item) => item.status === "error"),
    results,
  });
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}
