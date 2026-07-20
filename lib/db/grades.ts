import { getServiceClient } from "@/lib/supabase/server";

interface GradeSnapshot {
  currentPercent: number | null;
  currentLetterGrade: string;
  projectedPercent: number;
  projectedLetterGrade: string;
  isPF?: boolean;
}

/**
 * Upsert a course_grades row for a course.
 * course_grades.id is its own uuid (not tied to courses.id); the link is
 * course_grades.course_id → courses.id, with no unique constraint on
 * course_id. So this does an explicit lookup-then-update-or-insert (same
 * reasoning as upsertCourse in lib/db/courses.ts) rather than relying on
 * .upsert({ onConflict }), which needs a matching unique/exclusion
 * constraint to work.
 */
export async function upsertCourseGrade(
  courseUuid: string,
  snapshot: GradeSnapshot
): Promise<void> {
  const supabase = getServiceClient();

  const row = {
    course_id: courseUuid,
    current_percent: snapshot.currentPercent,
    current_letter_grade: snapshot.currentLetterGrade,
    projected_percent: snapshot.projectedPercent,
    projected_letter_grade: snapshot.projectedLetterGrade,
    is_pf: snapshot.isPF ?? false,
    calculated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("course_grades")
    .select("id")
    .eq("course_id", courseUuid)
    .maybeSingle();

  if (lookupError) throw new Error(`upsertCourseGrade lookup failed: ${lookupError.message}`);

  if (existing) {
    const { error } = await supabase
      .from("course_grades")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(`upsertCourseGrade update failed: ${error.message}`);
    return;
  }

  const { error } = await supabase.from("course_grades").insert(row);
  if (error) throw new Error(`upsertCourseGrade insert failed: ${error.message}`);
}
