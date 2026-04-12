import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
import { requireAIConfig } from "@/lib/ai/client";
import { compileAndStoreGradePolicy, getCompiledGradeCode } from "@/lib/skills/grade-policy-compiler";
import { runGradeCode } from "@/lib/skills/grade-runner";
import { categoryFromAggregated } from "@/lib/skills/grade-template";

export const runtime = "nodejs";

interface GradingCategory {
  id: string;
  name: string;
  weight: number;
  earned?: number;
}

/**
 * POST /api/grades/apply-policy
 *
 * Fetches the grading_policy from the syllabus, compiles it via AI (if not
 * already compiled), and runs the resulting code against the provided category
 * scores. Returns both the raw policy text and the calculated grade output.
 *
 * Body:
 *   courseId        uuid
 *   textCourseId    syllabus.course_id text key
 *   gradingWeights  GradingCategory[]
 *   optimisticScore number (default 85)
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { textCourseId, gradingWeights, optimisticScore = 85 } = (await req.json()) as {
      courseId: string;
      textCourseId: string;
      gradingWeights: GradingCategory[];
      optimisticScore?: number;
    };

    if (!textCourseId) {
      return NextResponse.json({ error: "textCourseId is required" }, { status: 400 });
    }

    // 1. Fetch grading_policy from syllabus
    const supabase = getServiceClient();
    const { data: syllabusRow, error: syllabusError } = await supabase
      .from("syllabus")
      .select("grading_policy")
      .eq("course_id", textCourseId)
      .single();

    if (syllabusError || !syllabusRow) {
      return NextResponse.json(
        { error: "No syllabus found for this course. Upload a syllabus PDF first." },
        { status: 404 }
      );
    }

    const gradingPolicy = syllabusRow.grading_policy as string | null;
    if (!gradingPolicy) {
      return NextResponse.json(
        { error: "No grading policy found in syllabus. The uploaded syllabus may not contain a grading breakdown." },
        { status: 404 }
      );
    }

    // 2. Always recompile on explicit user action so the latest prompt is used
    const aiConfig = await requireAIConfig(user.id);
    await compileAndStoreGradePolicy(textCourseId, gradingPolicy, aiConfig);

    // 3. Fetch compiled code from DB
    const compiledCode = await getCompiledGradeCode(textCourseId);
    if (!compiledCode) {
      return NextResponse.json(
        { error: "Failed to retrieve compiled grade code from database." },
        { status: 500 }
      );
    }

    // 4. Build category inputs and run the grade code
    const categories = (gradingWeights ?? []).map((g) =>
      categoryFromAggregated(g.id, g.name, g.weight, g.earned)
    );
    const result = runGradeCode(compiledCode, categories, optimisticScore);

    return NextResponse.json({ gradingPolicy, result });
  } catch (err) {
    console.error("[grades/apply-policy]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
