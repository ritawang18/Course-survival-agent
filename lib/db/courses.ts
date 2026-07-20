import { getServiceClient } from "@/lib/supabase/server";
import type { SyllabusParseResult } from "@/lib/parsers/syllabus";

/**
 * Upsert a row in the syllabus table, linked to an existing course.
 *
 * courseTextId is the syllabus table's PK (courses.course_id — the same
 * course's own text code, not derived from the parsed PDF, so re-uploads
 * always land on the same row regardless of what the parser outputs).
 * courseUuid is written to syllabus.course_uuid, a real FK to courses.id.
 *
 * The caller must already have verified courseUuid belongs to the
 * requesting user and resolved its course_id before calling this.
 */
export async function upsertSyllabus(
  syllabus: SyllabusParseResult,
  courseTextId: string,
  courseUuid: string
): Promise<string> {
  const supabase = getServiceClient();

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
        course_id: courseTextId,
        course_uuid: courseUuid,
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
  return courseTextId;
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

  const baseRow = {
    user_id: userId,
    course_id: courseId,
    course_name: syllabus.courseName ?? courseId,
    instructor_name: syllabus.instructor,
    attendance_allowed_misses: syllabus.attendancePolicy?.maxAbsences ?? 0,
    updated_at: new Date().toISOString(),
  };

  // attendance_penalty column may not exist yet — try with it, fall back without
  const penalty = syllabus.attendancePolicy?.penaltyPerAbsence ?? 0;
  let row: Record<string, unknown> = { ...baseRow, attendance_penalty: penalty };

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
    let { error: updateError } = await supabase
      .from("courses")
      .update(row)
      .eq("id", existing.id);
    if (updateError?.message?.includes("attendance_penalty")) {
      console.warn("[upsertCourse] attendance_penalty column not found, retrying without it");
      row = baseRow;
      ({ error: updateError } = await supabase
        .from("courses")
        .update(row)
        .eq("id", existing.id));
    }
    if (updateError) {
      throw new Error(`upsertCourse update failed: ${updateError.message}`);
    }
    return existing.id as string;
  }

  let { data: inserted, error: insertError } = await supabase
    .from("courses")
    .insert(row)
    .select("id")
    .single();
  if (insertError?.message?.includes("attendance_penalty")) {
    console.warn("[upsertCourse] attendance_penalty column not found, retrying without it");
    row = baseRow;
    ({ data: inserted, error: insertError } = await supabase
      .from("courses")
      .insert(row)
      .select("id")
      .single());
  }
  if (insertError) {
    throw new Error(
      `upsertCourse insert failed (user_id=${userId}, course_id=${courseId}): ${insertError.message}`
    );
  }
  return inserted!.id as string;
}

function isMissingTableError(message: string) {
  return /does not exist|schema cache|relation .* does not exist/i.test(message);
}

/**
 * Delete a course and every row that belongs to it across other tables.
 * Explicit deletes are used rather than relying solely on DB-level cascade
 * constraints, since those aren't guaranteed to be present.
 *
 * Ordering matters: courses.course_id references syllabus.course_id (syllabus
 * is the parent in that relationship), so the syllabus row must be deleted
 * AFTER the courses row — deleting it first would violate that FK while
 * courses still points at it. Every other table here references courses.id,
 * so those are safe to delete before the courses row.
 *
 * Deliberately NOT deleted:
 *   - professor_insights: a professor/university-level cache, not owned by
 *     any single course row.
 *
 * Throws if the course doesn't exist or doesn't belong to userId.
 */
export async function deleteCourse(courseId: string, userId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: course, error: lookupError } = await supabase
    .from("courses")
    .select("id, course_id")
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) throw new Error(`deleteCourse lookup failed: ${lookupError.message}`);
  if (!course) throw new Error("Course not found");

  const textCourseId = course.course_id as string;

  // courses <-> syllabus reference each other (courses.course_id -> syllabus.course_id,
  // and syllabus.course_uuid -> courses.id), so neither can be deleted first while
  // the other still points at it. Break the syllabus -> courses link via UPDATE
  // (not DELETE) so courses.course_id -> syllabus.course_id stays intact until
  // courses itself is gone.
  const { error: unlinkError } = await supabase
    .from("syllabus")
    .update({ course_uuid: null })
    .eq("course_uuid", courseId);
  if (unlinkError && !isMissingTableError(unlinkError.message)) {
    throw new Error(`deleteCourse syllabus unlink failed: ${unlinkError.message}`);
  }

  const relatedDeletes = await Promise.all([
    supabase.from("assignments").delete().eq("course_id", courseId),
    supabase.from("attendance_records").delete().eq("course_id", courseId),
    supabase.from("course_canvas_settings").delete().eq("course_uuid", courseId),
    supabase.from("course_grades").delete().eq("course_id", courseId),
    supabase.from("study_plan_blocks").delete().eq("course_uuid", courseId),
    supabase.from("weekly_course_pulse").delete().eq("course_uuid", courseId),
  ]);

  for (const { error } of relatedDeletes) {
    if (error && !isMissingTableError(error.message)) {
      throw new Error(`deleteCourse related-row delete failed: ${error.message}`);
    }
  }

  const { error: deleteError } = await supabase.from("courses").delete().eq("id", courseId);
  if (deleteError) throw new Error(`deleteCourse failed: ${deleteError.message}`);

  // courses.course_id -> syllabus.course_id is the reverse FK, so syllabus can
  // only be deleted after the courses row referencing it is gone.
  const { error: syllabusError } = await supabase
    .from("syllabus")
    .delete()
    .eq("course_id", textCourseId);
  if (syllabusError && !isMissingTableError(syllabusError.message)) {
    throw new Error(`deleteCourse syllabus delete failed: ${syllabusError.message}`);
  }
}
