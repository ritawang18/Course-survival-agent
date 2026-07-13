import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { upsertCourseGrade } from "@/lib/db/grades";
import {
  calculateCourse,
  toLetter,
  round,
  type CourseInput,
  type CourseResult,
} from "@/lib/skills/grade-calculator";

interface SemesterResult {
  semesterGPA: number;
  semesterGrade: number;
  courses: CourseResult[];
}

/**
 * POST /api/grades/calculate
 *
 * Body:
 * {
 *   courses: CourseInput[],
 *   optimisticScore?: number   // assumed score for ungraded work (default 85)
 * }
 *
 * Persists results to course_grades for each course that provides a courseId.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { courses, optimisticScore = 85 } = body as {
      courses: CourseInput[];
      optimisticScore?: number;
    };

    if (!Array.isArray(courses) || courses.length === 0) {
      return NextResponse.json({ error: "courses array is required" }, { status: 400 });
    }

    const courseResults: CourseResult[] = await Promise.all(
      courses.map((c) => calculateCourse(c, optimisticScore))
    );

    // ── Persist to course_grades ──────────────────────────────────────────────
    await Promise.all(
      courseResults.map((result, i) => {
        const input = courses[i];
        return upsertCourseGrade(input.courseId, {
          currentPercent: result.currentGrade,
          currentLetterGrade: result.letterGrade,
          projectedPercent: result.projectedGrade,
          projectedLetterGrade: toLetter(result.projectedGrade, courses[i].cutoffs),
          isPF: input.isPF,
        });
      })
    );

    const totalCredits = courseResults.reduce((s, c) => s + c.credits, 0);
    const semesterGPA =
      totalCredits > 0
        ? courseResults.reduce((s, c) => s + c.gpaPoints * c.credits, 0) / totalCredits
        : 0;
    const semesterGrade =
      totalCredits > 0
        ? courseResults.reduce((s, c) => s + c.projectedGrade * c.credits, 0) / totalCredits
        : 0;

    const result: SemesterResult = {
      semesterGPA: round(semesterGPA),
      semesterGrade: round(semesterGrade),
      courses: courseResults,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[grades/calculate]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
