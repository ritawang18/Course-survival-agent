import { getServiceClient } from "@/lib/supabase/server";
import type { SyllabusParseResult } from "@/lib/parsers/syllabus";

/**
 * Upsert a row in the syllabus table.
 * Must run BEFORE upsertCourse because courses.course_id FK references syllabus.course_id.
 * Returns the course_id (text) used as the PK.
 */
export async function upsertSyllabus(syllabus: SyllabusParseResult): Promise<string> {
  const supabase = getServiceClient();

  // course_id is the PK — use courseCode, fall back to courseName
  const courseId = syllabus.courseCode ?? syllabus.courseName;
  if (!courseId) throw new Error("Cannot upsert syllabus: no courseCode or courseName found.");

  // Split deadlines into projects vs everything else for project_date array
  const projectDates = syllabus.deadlines
    .filter((d) => d.confidence >= 0.7 && /project/i.test(d.label))
    .map((d) => ({ label: d.label, date: d.date, confidence: d.confidence }));

  const examDates = syllabus.examDates
    .filter((e) => e.confidence >= 0.7)
    .map((e) => ({ label: e.label, date: e.date, confidence: e.confidence }));

  const { error } = await supabase
    .from("syllabus")
    .upsert(
      {
        course_id: courseId,
        break_down: syllabus.weights,
        exam_dates: examDates,
        project_date: projectDates,
        cut_off: syllabus.cutoffs,
        topic_outline: syllabus.topicOutline,
        grading_policy: syllabus.gradingPolicy ?? null,
      },
      { onConflict: "course_id" }
    );

  if (error) throw new Error(`upsertSyllabus failed: ${error.message}`);
  return courseId;
}

/**
 * Upsert a course row.
 * Requires the syllabus row to exist first (FK constraint).
 * Uses (user_id, course_id) as the natural key.
 * Returns the course uuid.
 *
 * Implementation note: this does an explicit SELECT-then-UPDATE-or-INSERT
 * instead of supabase-js `.upsert({ onConflict: "user_id,course_id" })`.
 * The latter goes through PostgREST's ON CONFLICT path, which validates
 * against PostgREST's schema cache — if the unique constraint was added
 * after PostgREST started, the cache is stale and the request errors with
 * "no unique or exclusion constraint matching the ON CONFLICT specification"
 * even though the constraint exists in Postgres. Doing the lookup manually
 * sidesteps the cache entirely.
 */
export async function upsertCourse(
  userId: string,
  courseId: string,           // text — same value as syllabus.course_id
  syllabus: SyllabusParseResult
): Promise<string> {
  const supabase = getServiceClient();

  const row = {
    user_id: userId,
    course_id: courseId,
    course_name: syllabus.courseName ?? courseId,
    instructor_name: syllabus.instructor,
    attendance_allowed_misses: syllabus.attendancePolicy?.maxAbsences ?? 0,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: lookupError } = await supabase
    .from("courses")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`upsertCourse lookup failed: ${lookupError.message}`);
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from("courses")
      .update(row)
      .eq("id", existing.id);
    if (updateError) {
      throw new Error(`upsertCourse update failed: ${updateError.message}`);
    }
    return existing.id as string;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("courses")
    .insert(row)
    .select("id")
    .single();
  if (insertError) {
    throw new Error(
      `upsertCourse insert failed (user_id=${userId}, course_id=${courseId}): ${insertError.message}`
    );
  }
  return inserted.id as string;
}
