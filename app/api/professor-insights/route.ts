/**
 * POST /api/professor-insights
 *
 * Body: { professorName: string, universityName: string, courseId?: string }
 *
 * Pipeline:
 *   1. Zod-validate input.
 *   2. Cache check in Supabase: any row for this (professor, university) within
 *      the last 24 hours is reused as-is. Saves Claude tokens and makes
 *      re-clicks feel instant.
 *   3. Fan out to skills: fetchRmp + fetchReddit in parallel. Either side may
 *      return null — that's fine, the AI is told to use "unavailable".
 *   4. generateObject(anthropic) → { rmp, reddit } following InsightGenerationSchema.
 *   5. Persist to Supabase, return the assembled InstructorInsight.
 *
 * Error response shape: { ok: false, reason: 'invalid_input'|'network'|'ai_validation'|'internal' }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { fetchRmp } from "@/lib/skills/fetchRmp";
import { fetchReddit } from "@/lib/skills/fetchReddit";
import {
  InsightGenerationSchema,
  type InstructorInsight,
} from "@/lib/schemas/insight";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RequestSchema = z.object({
  professorName: z.string().min(1).max(200),
  universityName: z.string().min(1).max(200),
  courseId: z.string().optional(),
});

const CACHE_WINDOW_MS = 24 * 60 * 60 * 1000;
const TABLE = "professor_insights";

type ErrorReason = "invalid_input" | "network" | "ai_validation" | "internal";
function errorResponse(reason: ErrorReason, status: number, detail?: string) {
  return NextResponse.json({ ok: false, reason, detail }, { status });
}

export async function POST(req: NextRequest) {
  // 1. Validate input
  let body: z.infer<typeof RequestSchema>;
  try {
    const json = await req.json();
    body = RequestSchema.parse(json);
  } catch (err) {
    return errorResponse(
      "invalid_input",
      400,
      err instanceof Error ? err.message : "Invalid JSON body"
    );
  }

  const { professorName, universityName, courseId } = body;

  // 2. Cache check (24h window, case-insensitive)
  let supabase;
  try {
    supabase = getServerSupabase();
  } catch (err) {
    return errorResponse(
      "internal",
      500,
      err instanceof Error ? err.message : "Supabase init failed"
    );
  }

  const cutoff = new Date(Date.now() - CACHE_WINDOW_MS).toISOString();
  const { data: cachedRows, error: cacheErr } = await supabase
    .from(TABLE)
    .select("rmp, reddit, course_id, generated_at, professor_name, university_name")
    .ilike("professor_name", professorName)
    .ilike("university_name", universityName)
    .gte("generated_at", cutoff)
    .order("generated_at", { ascending: false })
    .limit(1);

  if (cacheErr) {
    console.error("[professor-insights] cache lookup failed", cacheErr);
    // Don't block on cache errors — fall through to a fresh fetch.
  } else if (cachedRows && cachedRows.length > 0) {
    const row = cachedRows[0];
    const insight: InstructorInsight = {
      courseId: courseId ?? row.course_id ?? undefined,
      professorName: row.professor_name,
      universityName: row.university_name,
      generatedAt: row.generated_at,
      rmp: row.rmp ?? null,
      reddit: row.reddit ?? null,
    };
    return NextResponse.json({ ok: true, insight, cached: true });
  }

  // 3. Fan out to skills (each already wrapped in 5s timeout, returns null on failure)
  const [rmpRaw, redditRaw] = await Promise.all([
    fetchRmp({ professorName, universityName }),
    fetchReddit({ professorName, universityName }),
  ]);

  // 4. Summarize with Claude via generateObject
  let generation: z.infer<typeof InsightGenerationSchema>;
  try {
    const result = await generateObject({
      model: anthropic("claude-sonnet-4-5"),
      schema: InsightGenerationSchema,
      system:
        "You summarize public feedback about a university professor for a student-facing course tracker. " +
        "Be concise, fair, and grounded ONLY in the raw data provided. " +
        'If a source is null or empty, set its sentiment to "unavailable", set summary to a short note like ' +
        '"No data found.", and return empty arrays for quotes and tags. ' +
        "Never invent quotes or scores. The RMP score must be the numeric average from the raw data, " +
        "or 0 if RMP is unavailable. Quotes must be verbatim excerpts from the raw input. " +
        "Tags should be 3-6 short descriptors (e.g. 'tough grader', 'engaging lectures').",
      prompt: JSON.stringify({
        professorName,
        universityName,
        rmpRaw,
        redditRaw,
      }),
    });
    generation = result.object;
  } catch (err) {
    console.error("[professor-insights] generateObject failed", err);
    const message = err instanceof Error ? err.message : "AI generation failed";
    // Distinguish schema validation from network-y / auth errors loosely.
    const reason: ErrorReason = /schema|validation|parse/i.test(message)
      ? "ai_validation"
      : "internal";
    return errorResponse(reason, 502, message);
  }

  const generatedAt = new Date().toISOString();
  const insight: InstructorInsight = {
    courseId,
    professorName,
    universityName,
    generatedAt,
    rmp: generation.rmp,
    reddit: generation.reddit,
  };

  // 5. Persist (best-effort — surface failure but still return the insight)
  const { error: insertErr } = await supabase.from(TABLE).insert({
    professor_name: professorName,
    university_name: universityName,
    course_id: courseId ?? null,
    rmp: generation.rmp,
    reddit: generation.reddit,
    raw_sources: { rmp: rmpRaw, reddit: redditRaw },
    generated_at: generatedAt,
  });
  if (insertErr) {
    console.error("[professor-insights] insert failed", insertErr);
  }

  return NextResponse.json({ ok: true, insight, cached: false });
}
