// grade-tools.ts answers what-if grade questions using lib/skills/grade-calculator.ts

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { requireAIConfig } from "@/lib/ai/client";
import {
  calculateCourse,
  type CourseInput,
  type GradeCutoff,
  type GradingCategory,
} from "@/lib/skills/grade-calculator";
import { compileAndStoreGradePolicy } from "@/lib/skills/grade-policy-compiler";
import type { AgentContext, ToolDefinition } from "@/lib/agent/types";

const OPTIMISTIC_SCORE = 85;
// 10 bisection steps gives ~0.1 percentage-point precision, which is plenty
// for a score-out-of-100 answer while keeping the DB round-trip count sane
// (calculateCourse re-fetches the compiled grade policy on every call).
const BINARY_SEARCH_STEPS = 10;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseWeights(raw: unknown): GradingCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const name = (item as Record<string, unknown>).name;
      const percent = (item as Record<string, unknown>).percent;
      if (typeof name !== "string" || typeof percent !== "number") return null;
      return { id: slugify(name) || `weight-${index + 1}`, name, weight: percent };
    })
    .filter((item): item is GradingCategory => item !== null);
}

function parseCutoffs(raw: unknown): GradeCutoff[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const grade = (item as Record<string, unknown>).grade;
      const minPercent = (item as Record<string, unknown>).minPercent;
      if (typeof grade !== "string" || typeof minPercent !== "number") return null;
      return { grade, minPercent };
    })
    .filter((item): item is GradeCutoff => item !== null);
}

// assignment_type is a small fixed set (homework/quiz/exam/project/lab/essay);
// category names are freeform syllabus text (e.g. "Quizzes", "Final Exam").
// Singular/plural-tolerant substring match covers the common cases.
function categoryMatchesAssignmentType(categoryName: string, assignmentType: string): boolean {
  if (!assignmentType) return false;
  const cat = categoryName.toLowerCase();
  const type = assignmentType.toLowerCase();
  return cat.includes(type) || type.includes(cat.replace(/e?s$/, ""));
}

export const calculateGradeScenarioTool: ToolDefinition<
  {
    courseId: string;
    categoryName: string;
    hypotheticalScore?: number;
    targetLetterGrade?: string;
  },
  {
    ok: boolean;
    message?: string;
    availableCategories?: string[];
    currentGrade?: number | null;
    categories?: { name: string; weight: number; earned: number | null }[];
    scenario?: {
      type: "what_if" | "score_needed";
      categoryName: string;
      hypotheticalScore?: number;
      resultingGrade?: number;
      resultingLetter?: string;
      targetLetterGrade?: string;
      scoreNeeded?: number | null; // null = not achievable even with a perfect score
      note?: string;
    };
  }
> = {
  name: "calculate_grade_scenario",
  description:
    "Answer what-if grade questions for a course: 'what happens if I score 85 on the final' (pass hypotheticalScore) or 'what score do I need on the final for an A' (pass targetLetterGrade) — pass exactly one of the two. categoryName must match one of the course's grading categories (case-insensitive substring match) — call get_course_syllabus first if unsure of the category names. Current scores for other categories are derived from graded assignments in the database (matched to categories by assignment type); categories with no graded assignments yet are assumed at an optimistic 85, same as the grade calculator page.",
  inputSchema: z
    .object({
      courseId: z.string().uuid(),
      categoryName: z.string().min(1),
      hypotheticalScore: z.number().min(0).max(100).optional(),
      targetLetterGrade: z.string().min(1).optional(),
    })
    .refine(
      (v) => (v.hypotheticalScore != null) !== (v.targetLetterGrade != null),
      { message: "Provide exactly one of hypotheticalScore or targetLetterGrade." }
    ),
  execute: async (args, ctx: AgentContext) => {
    const supabase = getServiceClient();

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, course_id")
      .eq("id", args.courseId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (courseError) throw new Error(`calculate_grade_scenario course lookup failed: ${courseError.message}`);
    if (!course) return { ok: false, message: "Course not found." };

    const { data: syllabusRow, error: syllabusError } = await supabase
      .from("syllabus")
      .select("break_down, cut_off")
      .eq("course_id", course.course_id as string)
      .maybeSingle();

    if (syllabusError) {
      throw new Error(`calculate_grade_scenario syllabus lookup failed: ${syllabusError.message}`);
    }

    const weights = parseWeights(syllabusRow?.break_down);
    if (weights.length === 0) {
      return { ok: false, message: "No grading breakdown found for this course yet." };
    }
    const cutoffs = parseCutoffs(syllabusRow?.cut_off);

    const needle = args.categoryName.toLowerCase();
    const matchedCategory =
      weights.find((w) => w.name.toLowerCase() === needle) ??
      weights.find((w) => w.name.toLowerCase().includes(needle) || needle.includes(w.name.toLowerCase()));

    if (!matchedCategory) {
      return {
        ok: false,
        message: `No grading category matching "${args.categoryName}" found.`,
        availableCategories: weights.map((w) => w.name),
      };
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("assignments")
      .select("assignment_type, score_received, points_possible")
      .eq("course_id", course.id as string)
      .not("score_received", "is", null)
      .not("points_possible", "is", null);

    if (assignmentError) {
      throw new Error(`calculate_grade_scenario assignment lookup failed: ${assignmentError.message}`);
    }

    const earnedByCategory = new Map<string, { earned: number; possible: number }>();
    for (const row of assignmentRows ?? []) {
      const type = (row.assignment_type as string) ?? "";
      const match = weights.find((w) => categoryMatchesAssignmentType(w.name, type));
      if (!match) continue;
      const bucket = earnedByCategory.get(match.id) ?? { earned: 0, possible: 0 };
      bucket.earned += row.score_received as number;
      bucket.possible += row.points_possible as number;
      earnedByCategory.set(match.id, bucket);
    }

    const baseGradingWeights: GradingCategory[] = weights.map((w) => {
      const agg = earnedByCategory.get(w.id);
      return {
        id: w.id,
        name: w.name,
        weight: w.weight,
        earned: agg && agg.possible > 0 ? (agg.earned / agg.possible) * 100 : undefined,
      };
    });

    const buildInput = (categoryScore: number | undefined): CourseInput => ({
      courseId: course.id as string,
      textCourseId: course.course_id as string,
      credits: 0,
      gradingWeights: baseGradingWeights.map((g) =>
        g.id === matchedCategory.id ? { ...g, earned: categoryScore } : g
      ),
      cutoffs,
    });

    if (args.hypotheticalScore != null) {
      const result = await calculateCourse(buildInput(args.hypotheticalScore), OPTIMISTIC_SCORE);
      return {
        ok: true,
        currentGrade: result.currentGrade,
        categories: result.categories.map((c) => ({ name: c.name, weight: c.weight, earned: c.earned })),
        scenario: {
          type: "what_if",
          categoryName: matchedCategory.name,
          hypotheticalScore: args.hypotheticalScore,
          resultingGrade: result.projectedGrade,
          resultingLetter: result.letterGrade,
        },
      };
    }

    // targetLetterGrade path — binary search the minimum score on this category
    // that reaches the cutoff. Assumes the grading policy is monotonic
    // non-decreasing in this category's own score, true for all standard
    // policies (weighted average, drop-lowest, curves, caps).
    const targetCutoff = cutoffs.find(
      (c) => c.grade.toLowerCase() === args.targetLetterGrade!.toLowerCase()
    );
    if (!targetCutoff) {
      return {
        ok: false,
        message: `"${args.targetLetterGrade}" isn't one of this course's grade cutoffs.`,
        availableCategories: cutoffs.map((c) => c.grade),
      };
    }

    const atMin = await calculateCourse(buildInput(0), OPTIMISTIC_SCORE);
    if (atMin.projectedGrade >= targetCutoff.minPercent) {
      return {
        ok: true,
        scenario: {
          type: "score_needed",
          categoryName: matchedCategory.name,
          targetLetterGrade: targetCutoff.grade,
          scoreNeeded: 0,
          note: `Already on track for a ${targetCutoff.grade} even with a 0 on ${matchedCategory.name}, based on other category scores.`,
        },
      };
    }

    const atMax = await calculateCourse(buildInput(100), OPTIMISTIC_SCORE);
    if (atMax.projectedGrade < targetCutoff.minPercent) {
      return {
        ok: true,
        scenario: {
          type: "score_needed",
          categoryName: matchedCategory.name,
          targetLetterGrade: targetCutoff.grade,
          scoreNeeded: null,
          note: `Not achievable — even a perfect 100 on ${matchedCategory.name} only reaches ${atMax.projectedGrade}%, below the ${targetCutoff.minPercent}% needed for ${targetCutoff.grade}.`,
        },
      };
    }

    let lo = 0;
    let hi = 100;
    for (let i = 0; i < BINARY_SEARCH_STEPS; i++) {
      const mid = (lo + hi) / 2;
      const result = await calculateCourse(buildInput(mid), OPTIMISTIC_SCORE);
      if (result.projectedGrade >= targetCutoff.minPercent) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    return {
      ok: true,
      scenario: {
        type: "score_needed",
        categoryName: matchedCategory.name,
        targetLetterGrade: targetCutoff.grade,
        scoreNeeded: Math.ceil(hi * 10) / 10,
      },
    };
  },
  sideEffect: false,
};

export const compileGradePolicyTool: ToolDefinition<
  { courseId: string },
  { compiled: boolean; message: string }
> = {
  name: "compile_grade_policy",
  description:
    "Compile a course's raw syllabus grading policy text into executable grade-calculation code, storing it for future use by calculate_grade_scenario and get_course_grade. Always recompiles even if a compiled version already exists (so re-run this after the syllabus changes). Requires the course to have a syllabus with a parsed grading policy — upload one first if this fails.",
  inputSchema: z.object({
    courseId: z.string().uuid(),
  }),
  execute: async (args, ctx: AgentContext) => {
    const supabase = getServiceClient();

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("course_id")
      .eq("id", args.courseId)
      .eq("user_id", ctx.userId)
      .maybeSingle();

    if (courseError) throw new Error(`compile_grade_policy course lookup failed: ${courseError.message}`);
    if (!course) return { compiled: false, message: "Course not found." };

    const { data: syllabusRow, error: syllabusError } = await supabase
      .from("syllabus")
      .select("grading_policy")
      .eq("course_id", course.course_id as string)
      .maybeSingle();

    if (syllabusError) {
      throw new Error(`compile_grade_policy syllabus lookup failed: ${syllabusError.message}`);
    }

    const gradingPolicy = syllabusRow?.grading_policy as string | null;
    if (!gradingPolicy) {
      return {
        compiled: false,
        message: "No grading policy found in this course's syllabus. Upload or parse a syllabus with a grading breakdown first.",
      };
    }

    const aiConfig = await requireAIConfig(ctx.userId);
    await compileAndStoreGradePolicy(course.course_id as string, gradingPolicy, aiConfig);

    return { compiled: true, message: "Grading policy compiled and saved." };
  },
  sideEffect: true, // writes syllabus.grading_code
};
