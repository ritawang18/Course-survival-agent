import { getServiceClient } from "@/lib/supabase/server";

const TABLE = "course_canvas_settings";

function isMissingTableOrColumnError(message: string) {
  return /does not exist|schema cache|relation .* does not exist|column .* does not exist/i.test(message);
}

export interface CourseCanvasSettingsRow {
  course_uuid: string;
  canvas_course_id: string | null;
  canvas_base_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCourseCanvasSettings(
  courseUuids: string[]
): Promise<CourseCanvasSettingsRow[]> {
  if (courseUuids.length === 0) return [];

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("course_uuid, canvas_course_id, canvas_base_url, created_at, updated_at")
    .in("course_uuid", courseUuids);

  if (error) {
    if (isMissingTableOrColumnError(error.message)) return [];
    throw new Error(`listCourseCanvasSettings failed: ${error.message}`);
  }

  return (data ?? []) as CourseCanvasSettingsRow[];
}

export async function getCourseCanvasSettings(
  courseUuid: string
): Promise<CourseCanvasSettingsRow | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("course_uuid, canvas_course_id, canvas_base_url, created_at, updated_at")
    .eq("course_uuid", courseUuid)
    .maybeSingle();

  if (error) {
    if (isMissingTableOrColumnError(error.message)) return null;
    throw new Error(`getCourseCanvasSettings failed: ${error.message}`);
  }

  return (data as CourseCanvasSettingsRow | null) ?? null;
}

export async function upsertCourseCanvasSettings(input: {
  courseUuid: string;
  canvasCourseId: string | null;
  canvasBaseUrl: string | null;
}): Promise<CourseCanvasSettingsRow> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        course_uuid: input.courseUuid,
        canvas_course_id: input.canvasCourseId,
        canvas_base_url: input.canvasBaseUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "course_uuid" }
    )
    .select("course_uuid, canvas_course_id, canvas_base_url, created_at, updated_at")
    .single();

  if (error) {
    throw new Error(`upsertCourseCanvasSettings failed: ${error.message}`);
  }

  return data as CourseCanvasSettingsRow;
}
