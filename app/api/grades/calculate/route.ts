import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase/server";
import { upsertCourseGrade } from "@/lib/db/grades";

interface GradeCutoff {
  grade: string;       // "A", "A-", "B+", etc.
  minPercent: number;
}

interface GradingCategory {
  id: string;
  name: string;
  weight: number;      // 0–100 percent of final grade
  earned?: number;     // 0–100 score, undefined if not yet graded
}

interface CourseInput {
  courseId: string;    // DB uuid — used to persist to course_grades
  credits: number;
  gradingWeights: GradingCategory[];
  cutoffs?: GradeCutoff[];  // from syllabus.cut_off — uses defaults if omitted
  isPF?: boolean;
}

interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  earned: number | null;
  contribution: number | null;
}

interface CourseResult {
  courseId: string;
  credits: number;
  currentGrade: number | null;
  projectedGrade: number;
  worstCaseGrade: number;
  letterGrade: string;
  gpaPoints: number;
  categories: CategoryResult[];
  ungradedWeight: number;
}

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

    const courseResults: CourseResult[] = courses.map((c) =>
      calculateCourse(c, optimisticScore)
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

// ── Calculation logic ─────────────────────────────────────────────────────────

function calculateCourse(c: CourseInput, optimisticScore: number): CourseResult {
  const categories: CategoryResult[] = c.gradingWeights.map((g) => ({
    id: g.id,
    name: g.name,
    weight: g.weight,
    earned: g.earned ?? null,
    contribution: g.earned != null ? round((g.earned / 100) * g.weight) : null,
  }));

  const gradedCategories = categories.filter((g) => g.earned != null);
  const ungradedCategories = categories.filter((g) => g.earned == null);
  const ungradedWeight = ungradedCategories.reduce((s, g) => s + g.weight, 0);
  const gradedWeight = gradedCategories.reduce((s, g) => s + g.weight, 0);

  const currentGrade =
    gradedWeight > 0
      ? round(
          gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0) /
            (gradedWeight / 100)
        )
      : null;

  const projectedGrade = round(
    gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0) +
      (optimisticScore / 100) * ungradedWeight
  );

  const worstCaseGrade = round(
    gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0)
  );

  const letterGrade = toLetter(projectedGrade, c.cutoffs);
  const gpaPoints = toGPA(projectedGrade, c.cutoffs);

  return {
    courseId: c.courseId,
    credits: c.credits,
    currentGrade,
    projectedGrade,
    worstCaseGrade,
    letterGrade,
    gpaPoints,
    categories,
    ungradedWeight,
  };
}

// ── Grade scale helpers ───────────────────────────────────────────────────────

const DEFAULT_CUTOFFS: GradeCutoff[] = [
  { grade: "A",  minPercent: 93 },
  { grade: "A-", minPercent: 90 },
  { grade: "B+", minPercent: 87 },
  { grade: "B",  minPercent: 83 },
  { grade: "B-", minPercent: 80 },
  { grade: "C+", minPercent: 77 },
  { grade: "C",  minPercent: 73 },
  { grade: "C-", minPercent: 70 },
  { grade: "D+", minPercent: 67 },
  { grade: "D",  minPercent: 60 },
];

/** Convert a numeric grade to a letter using course-specific cutoffs if provided. */
function toLetter(grade: number, cutoffs?: GradeCutoff[]): string {
  const scale = cutoffs && cutoffs.length > 0
    ? [...cutoffs].sort((a, b) => b.minPercent - a.minPercent)
    : DEFAULT_CUTOFFS;

  for (const cutoff of scale) {
    if (grade >= cutoff.minPercent) return cutoff.grade;
  }
  return "F";
}

/** Convert a numeric grade to GPA points using course-specific cutoffs if provided. */
function toGPA(grade: number, cutoffs?: GradeCutoff[]): number {
  const letter = toLetter(grade, cutoffs);
  const map: Record<string, number> = {
    "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0,
    "F": 0.0,
  };
  return map[letter] ?? 0.0;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
