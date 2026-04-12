import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getUserFromRequest } from "@/lib/supabase/server";
import type {
  AppData,
  Assignment,
  AssignmentStatus,
  Course,
} from "@/lib/store/types";

export const runtime = "nodejs";

/**
 * GET /api/me/data
 *
 * Loads the authenticated user's courses + assignments from Supabase
 * and returns an AppData-shaped payload the client store can drop in.
 *
 * This is the read-side counterpart to /api/upload. It exists so the
 * frontend AppStoreProvider can hydrate from real data instead of the
 * old lib/mock seed.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();

    const { data: courseRows, error: courseErr } = await supabase
      .from("courses")
      .select(
        "id, course_id, course_name, instructor_name, attendance_allowed_misses, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (courseErr) {
      throw new Error(`load courses failed: ${courseErr.message}`);
    }

    const courseUuids = (courseRows ?? []).map((c) => c.id as string);

    let assignmentRows:
      | {
          id: string;
          course_id: string;
          title: string;
          assignment_type: string;
          due_at: string | null;
          status: string;
          points_possible: number | null;
          estimated_hours: number | null;
          description: string | null;
          dependencies: string[] | null;
        }[]
      | null = null;

    if (courseUuids.length > 0) {
      const { data, error } = await supabase
        .from("assignments")
        .select(
          "id, course_id, title, assignment_type, due_at, status, points_possible, estimated_hours, description, dependencies"
        )
        .in("course_id", courseUuids);

      if (error) {
        throw new Error(`load assignments failed: ${error.message}`);
      }
      assignmentRows = data;
    }

    // Palette used to round-robin a color onto each course. The `color`
    // field exists only for UI chrome; the DB doesn't track it.
    const palette: Course["color"][] = [
      "indigo",
      "emerald",
      "amber",
      "rose",
      "sky",
      "violet",
    ];

    const courses: Course[] = (courseRows ?? []).map((row, i) => {
      const textCourseId = (row.course_id as string) ?? "";
      const courseName = (row.course_name as string) ?? textCourseId;
      const instructor = (row.instructor_name as string | null) ?? undefined;
      return {
        id: row.id as string,
        // Legacy UI aliases — many components still read these.
        code: textCourseId,
        name: courseName,
        instructor,
        color: palette[i % palette.length],
        // DB-aligned fields
        user_id: user.id,
        course_id: textCourseId,
        course_name: courseName,
        instructor_name: instructor,
        // Shared
        credits: 0,
        schedule: "",
        attendance_missed_count: 0,
        attendance_allowed_misses:
          (row.attendance_allowed_misses as number | null) ?? 0,
        // UI-only fields with no DB backing — default to safe empties.
        gradingWeights: [],
        files: [],
        modules: [],
        aiSummary: "",
        officeHourQuestions: [],
        mockExamQuestions: [],
        dependencyNotes: [],
      };
    });

    const assignments: Assignment[] = (assignmentRows ?? []).map((row) => ({
      id: row.id,
      course_id: row.course_id,
      title: row.title,
      assignment_type: row.assignment_type,
      description: row.description ?? undefined,
      due_at: row.due_at ?? undefined,
      points_possible: row.points_possible ?? undefined,
      status: (row.status as AssignmentStatus) ?? "not_started",
      estimated_hours: row.estimated_hours ?? undefined,
      dependencies: row.dependencies ?? [],
    }));

    const payload: AppData = {
      courses,
      assignments,
      exams: [],
      studyBlocks: [],
      uploads: [],
      insights: [],
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[me/data]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
