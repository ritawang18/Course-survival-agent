import { NextRequest, NextResponse } from "next/server";

interface GradingCategory {
  id: string;
  name: string;
  weight: number;   // 0–100 percent of final grade
  earned?: number;  // 0–100 score, undefined if not yet graded
}

interface CourseInput {
  courseId: string;
  credits: number;
  gradingWeights: GradingCategory[];
}

interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  earned: number | null;
  contribution: number | null; // (earned / 100) * weight
}

interface CourseResult {
  courseId: string;
  credits: number;
  currentGrade: number | null;       // weighted average of graded categories only
  projectedGrade: number;            // assumes `optimisticScore` for ungraded
  worstCaseGrade: number;            // assumes 0 for ungraded
  letterGrade: string;
  gpaPoints: number;                 // 4.0 scale
  categories: CategoryResult[];
  ungradedWeight: number;            // total weight of ungraded categories
}

interface SemesterResult {
  semesterGPA: number;              // credit-weighted
  semesterGrade: number;            // credit-weighted %
  courses: CourseResult[];
}

/**
 * POST /api/grades/calculate
 *
 * Body:
 * {
 *   courses: CourseInput[],
 *   optimisticScore?: number   // assumed score (0–100) for ungraded work (default 85)
 * }
 */
export async function POST(req: NextRequest) {
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function calculateCourse(c: CourseInput, optimisticScore: number): CourseResult {
  const categories: CategoryResult[] = c.gradingWeights.map((g) => ({
    id: g.id,
    name: g.name,
    weight: g.weight,
    earned: g.earned ?? null,
    contribution:
      g.earned != null ? round((g.earned / 100) * g.weight) : null,
  }));

  const gradedCategories = categories.filter((g) => g.earned != null);
  const ungradedCategories = categories.filter((g) => g.earned == null);
  const ungradedWeight = ungradedCategories.reduce((s, g) => s + g.weight, 0);

  // Current grade: weighted average of graded categories, re-normalized to their total weight
  const gradedWeight = gradedCategories.reduce((s, g) => s + g.weight, 0);
  const currentGrade =
    gradedWeight > 0
      ? round(
          gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0) /
            (gradedWeight / 100)
        )
      : null;

  // Projected: assume optimisticScore for ungraded
  const projectedGrade = round(
    gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0) +
      (optimisticScore / 100) * ungradedWeight
  );

  // Worst case: assume 0 for ungraded
  const worstCaseGrade = round(
    gradedCategories.reduce((s, g) => s + (g.earned! / 100) * g.weight, 0)
  );

  const letterGrade = toLetter(projectedGrade);
  const gpaPoints = toGPA(projectedGrade);

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

function toLetter(grade: number): string {
  if (grade >= 93) return "A";
  if (grade >= 90) return "A-";
  if (grade >= 87) return "B+";
  if (grade >= 83) return "B";
  if (grade >= 80) return "B-";
  if (grade >= 77) return "C+";
  if (grade >= 73) return "C";
  if (grade >= 70) return "C-";
  if (grade >= 67) return "D+";
  if (grade >= 60) return "D";
  return "F";
}

function toGPA(grade: number): number {
  if (grade >= 93) return 4.0;
  if (grade >= 90) return 3.7;
  if (grade >= 87) return 3.3;
  if (grade >= 83) return 3.0;
  if (grade >= 80) return 2.7;
  if (grade >= 77) return 2.3;
  if (grade >= 73) return 2.0;
  if (grade >= 70) return 1.7;
  if (grade >= 67) return 1.3;
  if (grade >= 60) return 1.0;
  return 0.0;
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
