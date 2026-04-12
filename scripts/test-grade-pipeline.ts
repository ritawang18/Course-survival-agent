/**
 * Quick end-to-end test for the grade policy pipeline.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/test-grade-pipeline.ts
 *
 * Runs two test cases:
 *   Case 1 — Basic policies: drop lowest quiz + midterm curve
 *   Case 2 — Dynamic exam weighting: higher-scoring exam gets 20%, lower gets 10%
 */

import { createClient } from "@supabase/supabase-js";
import { compileAndStoreGradePolicy, getCompiledGradeCode } from "../lib/skills/grade-policy-compiler";
import { runGradeCode } from "../lib/skills/grade-runner";
import type { TemplateCategoryInput } from "../lib/skills/grade-template";

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ── Test case definitions ─────────────────────────────────────────────────────

const CASES = [
  {
    id: "TEST-GRADE-CASE1",
    label: "Case 1: drop lowest quiz + midterm curve",
    policy: `
Grading Breakdown:
  Homework:   30%
  Quizzes:    20%  (lowest quiz score dropped)
  Midterm:    25%  (3 point curve applied to all students)
  Final Exam: 25%
`,
    categories: [
      {
        id: "hw",    name: "Homework",   weight: 30,
        scores: [88, 92, 75, 95, 85],
        pointsPossible: [100, 100, 100, 100, 100],
      },
      {
        id: "quiz",  name: "Quizzes",    weight: 20,
        scores: [70, 85, 60, 90, 80],
        pointsPossible: [100, 100, 100, 100, 100],
      },
      {
        id: "mid",   name: "Midterm",    weight: 25,
        scores: [78],
        pointsPossible: [100],
      },
      {
        id: "final", name: "Final Exam", weight: 25,
        scores: [],
        pointsPossible: [],
      },
    ] as TemplateCategoryInput[],
    groundTruth: [
      "Homework:   (88+92+75+95+85)/500 × 100 = 87.00%   contribution = 0.87 × 30 = 26.10",
      "Quizzes:    drop lowest (60) → (70+85+90+80)/400 × 100 = 81.25%   contribution = 0.8125 × 20 = 16.25",
      "Midterm:    78 + 3 curve = 81.00%   contribution = 0.81 × 25 = 20.25",
      "Final Exam: ungraded   contribution = 0",
      "currentGrade  = (26.10+16.25+20.25) / (75/100) = 62.60 / 0.75 = 83.47",
      "projectedGrade = 62.60 + (75/100) × 25 = 62.60 + 18.75 = 81.35",
      "worstCaseGrade = 62.60 + 0 = 62.60",
    ],
  },
  {
    id: "TEST-GRADE-CASE2",
    label: "Case 2: dynamic exam weighting (higher score → 20%, lower → 10%)",
    policy: `
Grading Breakdown:
  Homework: 70%
  Exams:    30% total — two exams, graded dynamically:
            the exam with the higher score counts for 20% of the final grade,
            the exam with the lower score counts for 10% of the final grade.

Example: if Exam 1 = 90 and Exam 2 = 80, then Exam 1 counts 20% and Exam 2 counts 10%.
`,
    categories: [
      {
        id: "hw",    name: "Homework",  weight: 70,
        scores: [85],
        pointsPossible: [100],
      },
      {
        id: "exams", name: "Exams",     weight: 30,
        scores: [90, 80],
        pointsPossible: [100, 100],
      },
    ] as TemplateCategoryInput[],
    groundTruth: [
      "Homework: 85.00%   contribution = 0.85 × 70 = 59.50",
      "Exams:    sort descending → [90, 80]; weights 20% and 10%",
      "          weighted avg = (90×20 + 80×10) / (20+10) = 2600/30 = 86.67%",
      "          contribution = 0.8667 × 30 = 26.00",
      "currentGrade   = (59.50 + 26.00) / (100/100) = 85.50",
      "projectedGrade = 85.50 (no ungraded categories)",
      "worstCaseGrade = 85.50",
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function seedSyllabus(courseId: string, policy: string) {
  const { error } = await getServiceClient()
    .from("syllabus")
    .upsert(
      { course_id: courseId, grading_policy: policy, break_down: [], exam_dates: [], project_date: [], cut_off: [] },
      { onConflict: "course_id" }
    );
  if (error) throw new Error(`Seed failed: ${error.message}`);
}

async function cleanupSyllabus(courseId: string) {
  await getServiceClient().from("syllabus").delete().eq("course_id", courseId);
}

function printOutput(output: ReturnType<typeof runGradeCode>) {
  console.log(`  Current grade:    ${output.currentGrade ?? "N/A (some ungraded)"}`);
  console.log(`  Projected grade:  ${output.projectedGrade}`);
  console.log(`  Worst-case grade: ${output.worstCaseGrade}`);
  console.log("  Per-category:");
  for (const cat of output.categories) {
    const avg = cat.processedAverage !== null ? `${cat.processedAverage}%` : "ungraded";
    console.log(`    ${cat.name.padEnd(12)} avg=${avg.padEnd(12)} contribution=${cat.contribution ?? 0}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runCase(c: (typeof CASES)[number]) {
  console.log(`\n── ${c.label} ──`);

  await seedSyllabus(c.id, c.policy);

  console.log("  → Compiling policy with Gemini...");
  const compiledCode = await compileAndStoreGradePolicy(c.id, c.policy);
  console.log("  ✓ Compiled. Generated slot contents:\n");

  // Extract each named slot: everything between the opening header comment and the closing ─── line
  const slotRegex = /──\s+(PREPROCESS|ADJUST|FINAL)\s+SLOT\s*─+\n([\s\S]*?)\/\/\s*─{5,}/g;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = slotRegex.exec(compiledCode)) !== null) {
    found = true;
    const slotName = m[1];
    const snippet = m[2].trim();
    console.log(`  [${slotName}]`);
    console.log("    " + (snippet || "(no-op)").replace(/\n/g, "\n    "));
    console.log();
  }
  if (!found) {
    // Fallback: print the raw compiled code so nothing is hidden
    console.log(compiledCode);
  }

  const fetched = await getCompiledGradeCode(c.id);
  if (!fetched) throw new Error("grading_code not persisted in syllabus table!");
  if (fetched !== compiledCode) throw new Error("grading_code in DB does not match compiled output!");

  console.log("  Ground truth:");
  for (const line of c.groundTruth) {
    console.log(`    ${line}`);
  }

  const output = runGradeCode(compiledCode, c.categories, 75);
  console.log("  → Actual output:");
  printOutput(output);

  await cleanupSyllabus(c.id);
  console.log("  ✓ Cleaned up");
}

async function main() {
  console.log("\n=== Grade Policy Pipeline Tests ===");
  for (const c of CASES) {
    await runCase(c);
  }
  console.log("\n=== All tests complete ===\n");
}

main().catch((err) => {
  console.error("\n✗ Test failed:", err);
  process.exit(1);
});
