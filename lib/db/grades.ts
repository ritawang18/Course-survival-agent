import { getServiceClient } from "@/lib/supabase/server";

interface GradeSnapshot {
  currentPercent: number | null;
  currentLetterGrade: string;
  projectedPercent: number;
  projectedLetterGrade: string;
  isPF?: boolean;
}

/**
 * Upsert a course_grades row.
 * course_grades.id is a FK to courses.id (one-to-one), so we use the
 * course uuid as the row id.
 */
export async function upsertCourseGrade(
  courseUuid: string,
  snapshot: GradeSnapshot
): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase
    .from("course_grades")
    .upsert(
      {
        id: courseUuid,
        current_percent: snapshot.currentPercent,
        current_letter_grade: snapshot.currentLetterGrade,
        projected_percent: snapshot.projectedPercent,
        projected_letter_grade: snapshot.projectedLetterGrade,
        is_pf: snapshot.isPF ?? false,
        calculated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) throw new Error(`upsertCourseGrade failed: ${error.message}`);
}
