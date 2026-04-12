/**
 * Grade Calculation Template
 *
 * This module defines a JavaScript code template that mirrors the logic in
 * app/api/grades/calculate/route.ts, but with named policy slots that the
 * LLM fills in based on parsed syllabus grading policies.
 *
 * Template slots:
 *   __PREPROCESS_SLOT__  — runs per-category, modifies scores[] before averaging
 *                          (e.g. drop lowest, best-of-N)
 *   __ADJUST_SLOT__      — runs per-category, modifies categoryAverage after aggregation
 *                          (e.g. curve a single category, cap extra credit)
 *   __FINAL_SLOT__       — runs once after all categories, modifies projectedGrade
 *                          (e.g. attendance penalty, overall curve, extra credit cap)
 *
 * Input shape (CategoryInput[]):
 *   Each category has individual scores[] and pointsPossible[] arrays.
 *   If only a pre-aggregated score is available, pass scores=[earned] and
 *   pointsPossible=[100] — the template handles both.
 */

// ── TypeScript types (used by route.ts and the compiler) ─────────────────────

export interface TemplateCategoryInput {
  id: string;
  name: string;
  weight: number;            // percent of final grade (0–100)
  scores: number[];          // individual scores, e.g. [85, 72, 90, 68]
  pointsPossible: number[];  // max points per score,  e.g. [100, 100, 100, 100]
}

export interface TemplateCategoryResult {
  id: string;
  name: string;
  weight: number;
  processedAverage: number | null;  // null if no scores submitted yet
  contribution: number | null;      // (processedAverage / 100) * weight
}

export interface TemplateOutput {
  currentGrade: number | null;   // weighted avg of graded categories only
  projectedGrade: number;        // graded + optimisticScore for ungraded
  worstCaseGrade: number;        // graded + 0 for ungraded
  categories: TemplateCategoryResult[];
}

// ── Slot definitions ──────────────────────────────────────────────────────────

export const SLOT_NAMES = ["PREPROCESS", "ADJUST", "FINAL"] as const;
export type SlotName = (typeof SLOT_NAMES)[number];

/**
 * Default no-op code for each slot.
 * Used when a policy doesn't require a given slot.
 */
export const SLOT_DEFAULTS: Record<SlotName, string> = {
  PREPROCESS: "// no preprocessing policy — use all scores as-is",
  ADJUST:     "// no per-category adjustment",
  FINAL:      "// no final grade adjustment",
};

/**
 * The grade calculation template.
 * Written in plain JavaScript (not TypeScript) so it can run in a Node vm sandbox.
 *
 * Variables available in __PREPROCESS_SLOT__:
 *   scores          — number[], mutable copy of raw scores
 *   pointsPossible  — number[], mutable copy of max points
 *   categoryName    — string
 *   categoryWeight  — number (0–100)
 *
 * Variables available in __ADJUST_SLOT__:
 *   categoryAverage — number (0–100), mutable
 *   categoryName    — string
 *   categoryWeight  — number
 *
 * Variables available in __FINAL_SLOT__:
 *   adjustedProjected — number (0–100), mutable
 *   worstCaseGrade    — number (0–100)
 *   currentGrade      — number | null
 */
export const GRADE_TEMPLATE = `
function calculateGradeWithPolicies(categories, optimisticScore) {
  var totalContribution = 0;
  var gradedWeight      = 0;
  var ungradedWeight    = 0;

  var categoryResults = categories.map(function(category) {
    var categoryName   = category.name;
    var categoryWeight = category.weight;

    // Ungraded category — no scores submitted yet
    if (!category.scores || category.scores.length === 0) {
      ungradedWeight += categoryWeight;
      return {
        id: category.id,
        name: categoryName,
        weight: categoryWeight,
        processedAverage: null,
        contribution: null,
      };
    }

    // Mutable copies for the preprocess slot to operate on
    var scores         = category.scores.slice();
    var pointsPossible = category.pointsPossible.slice();

    // ── PREPROCESS SLOT ───────────────────────────────────────────────────────
    // Policies: drop_lowest, best_of, etc.
    // May modify scores[] and pointsPossible[] arrays.
    __PREPROCESS_SLOT__
    // ─────────────────────────────────────────────────────────────────────────

    // Aggregate: sum(scores) / sum(pointsPossible) × 100
    var totalEarned   = scores.reduce(function(s, x) { return s + x; }, 0);
    var totalPossible = pointsPossible.reduce(function(s, x) { return s + x; }, 0);
    var categoryAverage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

    // ── ADJUST SLOT ───────────────────────────────────────────────────────────
    // Policies: per-category curve, extra credit cap, etc.
    // May modify categoryAverage (number).
    __ADJUST_SLOT__
    // ─────────────────────────────────────────────────────────────────────────

    // Cap at 100 unless extra credit is explicitly allowed
    categoryAverage = Math.min(categoryAverage, 100);

    var contribution = (categoryAverage / 100) * categoryWeight;
    totalContribution += contribution;
    gradedWeight      += categoryWeight;

    return {
      id: category.id,
      name: categoryName,
      weight: categoryWeight,
      processedAverage: Math.round(categoryAverage * 100) / 100,
      contribution: Math.round(contribution * 100) / 100,
    };
  });

  // Current grade: re-normalize over graded weight only
  var currentGrade = gradedWeight > 0
    ? Math.round((totalContribution / (gradedWeight / 100)) * 100) / 100
    : null;

  // Projected: assume optimisticScore for ungraded categories
  var projectedGrade  = totalContribution + (optimisticScore / 100) * ungradedWeight;
  var worstCaseGrade  = totalContribution; // assume 0 for ungraded

  // ── FINAL SLOT ────────────────────────────────────────────────────────────
  // Policies: attendance penalty, overall curve, extra credit ceiling, etc.
  // May modify adjustedProjected (number).
  var adjustedProjected = projectedGrade;
  __FINAL_SLOT__
  // ─────────────────────────────────────────────────────────────────────────

  adjustedProjected = Math.max(0, Math.min(adjustedProjected, 100));

  return {
    currentGrade:   currentGrade,
    projectedGrade: Math.round(adjustedProjected * 100) / 100,
    worstCaseGrade: Math.round(worstCaseGrade * 100) / 100,
    categories:     categoryResults,
  };
}
`;

// ── Template filler ───────────────────────────────────────────────────────────

/**
 * Substitute policy slots into the template.
 * Any slot not provided falls back to its no-op default.
 *
 * @param slots  Map of slot name → LLM-generated code snippet
 * @returns      Executable JavaScript string ready for the vm runner
 */
export function fillTemplate(slots: Partial<Record<SlotName, string>>): string {
  let code = GRADE_TEMPLATE;
  for (const name of SLOT_NAMES) {
    const snippet = slots[name] ?? SLOT_DEFAULTS[name];
    code = code.replace(`__${name}_SLOT__`, snippet);
  }
  return code;
}

/**
 * Build a TemplateCategoryInput from a pre-aggregated earned score (0–100).
 * Use this when you only have a single number per category, not individual scores.
 */
export function categoryFromAggregated(
  id: string,
  name: string,
  weight: number,
  earned: number | undefined
): TemplateCategoryInput {
  if (earned == null) {
    return { id, name, weight, scores: [], pointsPossible: [] };
  }
  return { id, name, weight, scores: [earned], pointsPossible: [100] };
}
