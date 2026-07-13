/**
 * Grade Calculator
 *
 * Shared calculation core used by both POST /api/grades/calculate (the
 * frontend grade calculator page) and the calculate_grade_scenario agent
 * tool. Runs the compiled per-course grading policy if one exists
 * (syllabus.grading_code via the vm runner), else falls back to a plain
 * weighted average.
 */

import { getCompiledGradeCode } from "./grade-policy-compiler";
import { runGradeCode } from "./grade-runner";
import { categoryFromAggregated } from "./grade-template";

export interface GradeCutoff {
  grade: string; // "A", "A-", "B+", etc.
  minPercent: number;
}

export interface GradingCategory {
  id: string;
  name: string;
  weight: number; // 0–100 percent of final grade
  earned?: number; // 0–100 score, undefined if not yet graded
}

export interface CourseInput {
  courseId: string; // DB uuid
  textCourseId?: string; // syllabus.course_id text key — for compiled policy lookup
  credits: number;
  gradingWeights: GradingCategory[];
  cutoffs?: GradeCutoff[]; // from syllabus.cut_off — uses defaults if omitted
  isPF?: boolean;
}

export interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  earned: number | null;
  contribution: number | null;
}

export interface CourseResult {
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

export async function calculateCourse(
  c: CourseInput,
  optimisticScore: number
): Promise<CourseResult> {
  // Try compiled grade policy first (from syllabus.grading_code via vm runner)
  if (c.textCourseId) {
    try {
      const compiledCode = await getCompiledGradeCode(c.textCourseId);
      if (compiledCode) {
        const templateCategories = c.gradingWeights.map((g) =>
          categoryFromAggregated(g.id, g.name, g.weight, g.earned)
        );
        const output = runGradeCode(compiledCode, templateCategories, optimisticScore);
        const ungradedWeight = output.categories
          .filter((cat) => cat.processedAverage === null)
          .reduce((s, cat) => s + cat.weight, 0);
        const projectedGrade = round(output.projectedGrade);
        return {
          courseId: c.courseId,
          credits: c.credits,
          currentGrade: output.currentGrade !== null ? round(output.currentGrade) : null,
          projectedGrade,
          worstCaseGrade: round(output.worstCaseGrade),
          letterGrade: toLetter(projectedGrade, c.cutoffs),
          gpaPoints: toGPA(projectedGrade, c.cutoffs),
          categories: output.categories.map((cat) => ({
            id: cat.id,
            name: cat.name,
            weight: cat.weight,
            earned: cat.processedAverage,
            contribution: cat.contribution,
          })),
          ungradedWeight,
        };
      }
    } catch (err) {
      // Fall through to default calculation if compiled runner fails
      console.warn("[grade-calculator] compiled runner failed, using fallback:", err);
    }
  }

  // Default calculation (no compiled policy)
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

export const DEFAULT_CUTOFFS: GradeCutoff[] = [
  { grade: "A", minPercent: 93 },
  { grade: "A-", minPercent: 90 },
  { grade: "B+", minPercent: 87 },
  { grade: "B", minPercent: 83 },
  { grade: "B-", minPercent: 80 },
  { grade: "C+", minPercent: 77 },
  { grade: "C", minPercent: 73 },
  { grade: "C-", minPercent: 70 },
  { grade: "D+", minPercent: 67 },
  { grade: "D", minPercent: 60 },
];

/** Convert a numeric grade to a letter using course-specific cutoffs if provided. */
export function toLetter(grade: number, cutoffs?: GradeCutoff[]): string {
  const scale =
    cutoffs && cutoffs.length > 0
      ? [...cutoffs].sort((a, b) => b.minPercent - a.minPercent)
      : DEFAULT_CUTOFFS;

  for (const cutoff of scale) {
    if (grade >= cutoff.minPercent) return cutoff.grade;
  }
  return "F";
}

/** Convert a numeric grade to GPA points using course-specific cutoffs if provided. */
export function toGPA(grade: number, cutoffs?: GradeCutoff[]): number {
  const letter = toLetter(grade, cutoffs);
  const map: Record<string, number> = {
    A: 4.0,
    "A-": 3.7,
    "B+": 3.3,
    B: 3.0,
    "B-": 2.7,
    "C+": 2.3,
    C: 2.0,
    "C-": 1.7,
    "D+": 1.3,
    D: 1.0,
    F: 0.0,
  };
  return map[letter] ?? 0.0;
}

export function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
