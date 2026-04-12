/**
 * Grade Runner
 *
 * Executes the LLM-compiled grade calculation code stored in syllabus.grading_code
 * inside a Node.js vm sandbox with a strict timeout.
 *
 * The sandbox exposes only Math and console.error — no I/O, no require, no globals.
 *
 * Flow:
 *   grading_code (from DB) + categories (runtime data) → vm.runInContext → TemplateOutput
 */

import vm from "vm";
import type { TemplateCategoryInput, TemplateOutput } from "./grade-template";

// Maximum milliseconds the sandbox may run before being killed
const SANDBOX_TIMEOUT_MS = 2_000;

// Default optimistic score used when projecting ungraded categories
const DEFAULT_OPTIMISTIC_SCORE = 75;

/**
 * Run pre-compiled grade code in a sandboxed vm.
 *
 * @param compiledCode   The filled template string from syllabus.grading_code
 * @param categories     Per-category score data (from assignments/grades)
 * @param optimisticScore Score to assume for ungraded categories (default 75)
 * @returns              Calculated grade breakdown
 * @throws               If the vm times out, throws an error or returns invalid output
 */
export function runGradeCode(
  compiledCode: string,
  categories: TemplateCategoryInput[],
  optimisticScore: number = DEFAULT_OPTIMISTIC_SCORE
): TemplateOutput {
  // Build a restricted sandbox — only Math is exposed
  const sandbox = vm.createContext({
    Math,
    console: { error: console.error }, // allow console.error for debugging policy code
    result: undefined as unknown,
  });

  // Inject the compiled function definition + a call that stores the output
  const script = new vm.Script(`
    ${compiledCode}
    result = calculateGradeWithPolicies(
      ${JSON.stringify(categories)},
      ${JSON.stringify(optimisticScore)}
    );
  `);

  try {
    script.runInContext(sandbox, { timeout: SANDBOX_TIMEOUT_MS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[grade-runner] vm execution failed: ${message}`);
  }

  return validateOutput(sandbox.result);
}

// ── Output validation ─────────────────────────────────────────────────────────

function validateOutput(raw: unknown): TemplateOutput {
  if (!raw || typeof raw !== "object") {
    throw new Error("[grade-runner] vm returned non-object result");
  }

  const r = raw as Record<string, unknown>;

  if (
    (r.currentGrade !== null && typeof r.currentGrade !== "number") ||
    typeof r.projectedGrade !== "number" ||
    typeof r.worstCaseGrade !== "number" ||
    !Array.isArray(r.categories)
  ) {
    throw new Error(
      "[grade-runner] vm result has unexpected shape: " + JSON.stringify(r)
    );
  }

  return r as unknown as TemplateOutput;
}
