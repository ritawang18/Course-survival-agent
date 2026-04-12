/**
 * Grade Policy Compiler
 *
 * Reads the raw grading_policy text from the syllabus table, sends it to
 * Gemini, and gets back JavaScript code snippets for each template slot.
 * The filled template is then stored in syllabus.grading_code so this only
 * runs once per syllabus upload — not on every grade calculation.
 *
 * Flow:
 *   grading_policy (text) → Gemini → slot snippets → fillTemplate → grading_code (text)
 */

import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { fillTemplate, GRADE_TEMPLATE, SLOT_DEFAULTS, type SlotName } from "./grade-template";
import { getServiceClient } from "@/lib/supabase/server";

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at converting academic grading policies into JavaScript code snippets.

You will be given the grading policy text from a course syllabus. Your job is to produce code snippets for up to three named slots in a grade calculation template.

SLOT DESCRIPTIONS AND AVAILABLE VARIABLES:

1. PREPROCESS (runs per-category, before computing the average)
   Available variables:
   - scores: number[]         — mutable array of raw scores (modify this)
   - pointsPossible: number[] — mutable array of max points per score (modify alongside scores)
   - categoryName: string     — name of the grading category (e.g. "Quizzes")
   - categoryWeight: number   — percent weight of this category (0–100)
   Use for: drop lowest N scores, keep best N of M, dynamic per-score weighting, etc.
   Example for "drop lowest quiz score":
     if (/quiz/i.test(categoryName) && scores.length > 1) {
       var minIdx = scores.indexOf(Math.min.apply(null, scores));
       scores.splice(minIdx, 1);
       pointsPossible.splice(minIdx, 1);
     }
   Example for "two exams: higher score counts 20%, lower counts 10% of final grade":
     (Use PREPROCESS — NOT ADJUST — because we must re-weight individual scores before averaging.)
     if (/exam/i.test(categoryName) && scores.length === 2) {
       var pairs = [{s: scores[0], pp: pointsPossible[0]}, {s: scores[1], pp: pointsPossible[1]}];
       pairs.sort(function(a, b) { return b.s - a.s; });
       scores[0] = pairs[0].s * 2; pointsPossible[0] = pairs[0].pp * 2;
       scores[1] = pairs[1].s * 1; pointsPossible[1] = pairs[1].pp * 1;
     }
     (This scales pointsPossible 2:1 so the weighted average = (higher×2 + lower×1)/(pp×2 + pp×1).)

2. ADJUST (runs per-category, after computing categoryAverage)
   Available variables:
   - categoryAverage: number  — the computed average (0–100), reassign to change it
   - categoryName: string
   - categoryWeight: number
   Use for: curve a single category, cap at a value, add flat bonus points.
   Example for "add 3 point curve to midterm":
     if (/midterm/i.test(categoryName)) { categoryAverage = Math.min(categoryAverage + 3, 100); }

3. FINAL (runs once after all categories)
   Available variables:
   - adjustedProjected: number — the final projected grade (0–100), reassign to change it
   - currentGrade: number | null
   - worstCaseGrade: number
   Use for: attendance penalty, overall extra credit, final grade cap/floor.
   Example for "5% penalty if more than 3 absences" (absences injected as context):
     if (typeof absences !== 'undefined' && absences > 3) {
       adjustedProjected = Math.max(0, adjustedProjected - (absences - 3) * 5);
     }

RULES:
- Output ONLY valid JSON with keys "PREPROCESS", "ADJUST", "FINAL"
- Each value is a JavaScript code string for that slot, or null if not needed
- Use only var (no let/const/class) — the code runs in a restricted vm sandbox
- Do NOT use require(), import, fetch, or any I/O
- Do NOT add function declarations — only inline statements
- Variable names must exactly match those listed above
- If a policy does not require a slot, set it to null
- If the policy is ambiguous, write a conservative implementation with a comment
- CRITICAL: In the JSON output, all newlines inside string values MUST be escaped as \n — never emit literal newlines inside a JSON string value
- Dynamic per-score weighting (e.g. higher exam counts more) MUST go in PREPROCESS by scaling scores[] and pointsPossible[] — ADJUST only has a single categoryAverage number and cannot re-weight individual scores

OUTPUT FORMAT (return only this JSON, no prose, no markdown fences):
{
  "PREPROCESS": "<code or null>",
  "ADJUST": "<code or null>",
  "FINAL": "<code or null>"
}`;

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compile a grading_policy text into executable JavaScript using Gemini,
 * then persist the result to syllabus.grading_code.
 *
 * @param courseId       The text course_id (PK of the syllabus table)
 * @param gradingPolicy  Raw grading_policy text from syllabus table
 * @returns              The filled template code string (also saved to DB)
 */
export async function compileAndStoreGradePolicy(
  courseId: string,
  gradingPolicy: string
): Promise<string> {
  const slots = await callGemini(gradingPolicy);
  const filledCode = fillTemplate(slots);
  await persistGradingCode(courseId, filledCode);
  return filledCode;
}

/**
 * Fetch pre-compiled grading code from the DB.
 * Returns null if no code has been compiled yet for this course.
 */
export async function getCompiledGradeCode(courseId: string): Promise<string | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("syllabus")
    .select("grading_code")
    .eq("course_id", courseId)
    .single();

  if (error || !data?.grading_code) return null;
  return data.grading_code as string;
}

// ── Gemini call ───────────────────────────────────────────────────────────────

async function callGemini(
  gradingPolicy: string
): Promise<Partial<Record<SlotName, string>>> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY env var");
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    prompt: `Grading policy from syllabus:\n\n${gradingPolicy}`,
    maxOutputTokens: 2048,
    temperature: 0.1,   // low temperature for deterministic code generation
  });

  return parseGeminiResponse(text);
}

function parseGeminiResponse(raw: string): Partial<Record<SlotName, string>> {
  // Strip markdown fences if Gemini wraps in ```json ... ```
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: Record<string, string | null>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Gemini sometimes emits literal newlines inside JSON string values instead of \n.
    // Repair by finding each JSON string and escaping any bare newlines within it.
    try {
      const repaired = cleaned.replace(/"((?:[^"\\]|\\[\s\S])*)"/gs, (_, content: string) =>
        '"' + content.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t") + '"'
      );
      parsed = JSON.parse(repaired);
    } catch {
      console.error("[grade-policy-compiler] Gemini returned invalid JSON:", raw);
      return {};
    }
  }

  const slots: Partial<Record<SlotName, string>> = {};
  const validSlots: SlotName[] = ["PREPROCESS", "ADJUST", "FINAL"];

  for (const slot of validSlots) {
    const value = parsed[slot];
    if (typeof value === "string" && value.trim()) {
      slots[slot] = value.trim();
    }
    // null or missing → slot stays undefined → fillTemplate uses no-op default
  }

  return slots;
}

// ── DB write ──────────────────────────────────────────────────────────────────

async function persistGradingCode(courseId: string, code: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("syllabus")
    .update({ grading_code: code })
    .eq("course_id", courseId);

  if (error) throw new Error(`persistGradingCode failed: ${error.message}`);
}
