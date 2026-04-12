import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";

/**
 * POST /api/courses
 *
 * Manually create a course without a syllabus file.
 * Creates a minimal syllabus stub first (FK requirement), then the courses row.
 *
 * Body:
 * {
 *   course_name: string        — required
 *   term?: string
 *   instructor_name?: string
 *   current_grade_percent?: number
 *   attendance_missed_count?: number
 *   credits?: number
 * }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      course_id: courseIdInput,
      course_name,
      term,
      instructor_name,
      current_grade_percent,
      attendance_missed_count,
      attendance_allowed_misses,
      credits,
    } = body as {
      course_id?: string;
      course_name: string;
      term?: string;
      instructor_name?: string;
      current_grade_percent?: number;
      attendance_missed_count?: number;
      attendance_allowed_misses?: number;
      credits?: number;
    };

    if (!course_name?.trim()) {
      return NextResponse.json({ error: "course_name is required" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // Use the user-provided course_id if given, otherwise derive from course_name.
    // Append a timestamp suffix to avoid collisions when no explicit id is provided.
    const courseTextId = courseIdInput?.trim()
      ? courseIdInput.trim()
      : `${course_name.trim()}_${Date.now()}`;

    // syllabus row must exist before courses row (FK constraint)
    const { error: syllabusErr } = await supabase
      .from("syllabus")
      .insert({
        course_id: courseTextId,
        break_down: [],
        exam_dates: [],
        project_date: [],
        cut_off: [],
        topic_outline: [],
      });

    if (syllabusErr) {
      return NextResponse.json(
        { error: `Failed to create syllabus stub: ${syllabusErr.message}` },
        { status: 500 }
      );
    }

    // Create the course row
    const { data: courseRow, error: courseErr } = await supabase
      .from("courses")
      .insert({
        user_id: user.id,
        course_id: courseTextId,
        course_name: course_name.trim(),
        term: term?.trim() || null,
        instructor_name: instructor_name?.trim() || null,
        current_grade_percent: current_grade_percent ?? null,
        attendance_missed_count: attendance_missed_count ?? 0,
        attendance_allowed_misses: attendance_allowed_misses ?? 0,
        credits: credits ?? null,
      })
      .select("id")
      .single();

    if (courseErr) {
      // Clean up the syllabus stub if course insert fails
      await supabase.from("syllabus").delete().eq("course_id", courseTextId);
      return NextResponse.json(
        { error: `Failed to create course: ${courseErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: courseRow.id, course_id: courseTextId });
  } catch (err) {
    console.error("[courses/create]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
