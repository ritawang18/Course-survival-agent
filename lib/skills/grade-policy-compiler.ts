/**
 * Grade Policy Compiler
 *
 * Reads the raw grading_policy text from the syllabus table, sends it to
 * the configured LLM provider, and gets back JavaScript code snippets for
 * each template slot. The filled template is then stored in
 * syllabus.grading_code so this only runs once per syllabus upload.
 */

import type { AIConfig } from "@/lib/ai/client";
import { generateTextWithAI } from "@/lib/ai/client";
import { fillTemplate, type SlotName } from "./grade-template";
import { getServiceClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `You are an expert at converting academic grading policies into JavaScript code snippets.

You will be given the grading policy text from a course syllabus. Your job is to produce code snippets for up to three named slots in a grade calculation template.

SLOT DESCRIPTIONS AND AVAILABLE VARIABLES:

1. PREPROCESS (runs per-category, before computing the average)
   Available variables:
   - scores: number[]         — mutable array of raw scores (modify this)
   - pointsPossible: number[] — mutable array of max points per score (modify alongside scores)
   - categoryName: string     — name of the grading category (e.g. "Quizzes")
   - categoryWeight: number   — percent weight of this category (0–100)
   Use for: drop lowest N scores, keep best N of M, etc.
   Example for "drop lowest quiz score":
     if (/quiz/i.test(categoryName) && scores.length > 1) {
       var minIdx = scores.indexOf(Math.min.apply(null, scores));
       scores.splice(minIdx, 1);
       pointsPossible.splice(minIdx, 1);
     }

2. ADJUST (runs per-category, after computing categoryAverage)
   Available variables:
   - categoryAverage: number  — the computed average (0–100), reassign to change it
   - categoryName: string
   - categoryWeight: number
   Use for: curve a single category, cap at a value, add flat bonus points.

3. FINAL (runs once after all categories)
   Available variables:
   - adjustedProjected: number — the final projected grade (0–100), reassign to change it
   - currentGrade: number | null
   - worstCaseGrade: number
   Use for: attendance penalty, overall extra credit, final grade cap/floor.

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

export async function compileAndStoreGradePolicy(
  courseId: string,
  gradingPolicy: string,
  aiConfig: AIConfig
): Promise<string> {
  const slots = await callModel(gradingPolicy, aiConfig);
  const filledCode = fillTemplate(slots);
  await persistGradingCode(courseId, filledCode);
  return filledCode;
}

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

async function callModel(
  gradingPolicy: string,
  aiConfig: AIConfig
): Promise<Partial<Record<SlotName, string>>> {
  const { text } = await generateTextWithAI({
    config: aiConfig,
    system: SYSTEM_PROMPT,
    prompt: `Grading policy from syllabus:\n\n${gradingPolicy}`,
    maxOutputTokens: 1024,
    temperature: 0.1,   // low temperature for deterministic code generation
  });

  return parseModelResponse(text);
}

function parseModelResponse(raw: string): Partial<Record<SlotName, string>> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let parsed: Record<string, string | null>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[grade-policy-compiler] Gemini returned invalid JSON:", raw);
    // Fall back to all defaults — calculation still works, just without policies
    return {};
  }

  const slots: Partial<Record<SlotName, string>> = {};
  const validSlots: SlotName[] = ["PREPROCESS", "ADJUST", "FINAL"];

  for (const slot of validSlots) {
    const value = parsed[slot];
    if (typeof value === "string" && value.trim()) {
      slots[slot] = value.trim();
    }
  }

  return slots;
}

async function persistGradingCode(courseId: string, code: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("syllabus")
    .update({ grading_code: code })
    .eq("course_id", courseId);

  if (error) throw new Error(`persistGradingCode failed: ${error.message}`);
}
