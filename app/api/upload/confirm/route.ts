import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
import { upsertSyllabus, upsertCourse } from "@/lib/db/courses";
import { insertSyllabusAssignments, insertAssignment } from "@/lib/db/assignments";
import { compileAndStoreGradePolicy } from "@/lib/skills/grade-policy-compiler";
import { requireAIConfig } from "@/lib/ai/client";
import type { SyllabusParseResult } from "@/lib/parsers/syllabus";
import type { AssignmentParseResult } from "@/lib/parsers/assignment";

export const runtime = "nodejs";

/**
 * POST /api/upload/confirm
 *
 * Persists previously-parsed upload data to the database after the user
 * has reviewed (and optionally edited) the extraction results.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { kind, extracted, courseId } = body as {
      kind: "syllabus" | "assignment";
      extracted: Record<string, unknown>;
      courseId?: string;
    };

    if (!kind || !extracted) {
      return NextResponse.json(
        { error: "kind and extracted are required" },
        { status: 400 }
      );
    }

    // ── Assignment confirm ────────────────────────────────────────────────
    if (kind === "assignment") {
      if (!courseId) {
        return NextResponse.json(
          { error: "courseId is required for assignment uploads" },
          { status: 400 }
        );
      }

      const raw = extracted.assignment as Record<string, unknown> | undefined;
      if (!raw) {
        return NextResponse.json(
          { error: "extracted.assignment is required" },
          { status: 400 }
        );
      }

      const assignment: AssignmentParseResult = {
        title: (raw.title as string) ?? null,
        totalPoints: (raw.totalPoints as number) ?? null,
        dueDate: (raw.dueDate as string) ?? null,
        estimatedHours: (raw.estimatedHours as number) ?? 0,
        difficulty: (raw.difficulty as "easy" | "medium" | "hard") ?? "medium",
        questions: (raw.questions as AssignmentParseResult["questions"]) ?? [],
        conceptDependencies: (raw.conceptDependencies as AssignmentParseResult["conceptDependencies"]) ?? [],
        implicitRequirements: (raw.implicitRequirements as string[]) ?? [],
      };

      const assignmentId = await insertAssignment(courseId, assignment);

      return NextResponse.json({ ok: true, assignmentId });
    }

    // ── Syllabus confirm ──────────────────────────────────────────────────
    const syllabusData: SyllabusParseResult = {
      deadlines: (extracted.deadlines as SyllabusParseResult["deadlines"]) ?? [],
      weights: (extracted.weights as SyllabusParseResult["weights"]) ?? [],
      examDates: (extracted.examDates as SyllabusParseResult["examDates"]) ?? [],
      cutoffs: (extracted.cutoffs as SyllabusParseResult["cutoffs"]) ?? [],
      topicOutline: (extracted.topicOutline as SyllabusParseResult["topicOutline"]) ?? [],
      attendancePolicy: (extracted.attendancePolicy as SyllabusParseResult["attendancePolicy"]) ?? {
        text: "",
        maxAbsences: null,
        penaltyPerAbsence: null,
        confidence: 0,
      },
      courseCode: (extracted.courseCode as string) ?? null,
      courseName: (extracted.courseName as string) ?? null,
      instructor: (extracted.instructor as string) ?? null,
      gradingPolicy: (extracted.gradingPolicy as string) ?? null,
    };

    const syllabusId = await upsertSyllabus(syllabusData);
    const newCourseId = await upsertCourse(user.id, syllabusId, syllabusData);
    const assignmentsCreated = await insertSyllabusAssignments(newCourseId, syllabusData);

    // Compile grading policy if present
    if (syllabusData.gradingPolicy) {
      try {
        const aiConfig = await requireAIConfig(user.id);
        await compileAndStoreGradePolicy(syllabusId, syllabusData.gradingPolicy, aiConfig);
      } catch (compileErr) {
        console.warn("[upload/confirm] grade policy compilation skipped:", compileErr);
      }
    }

    return NextResponse.json({
      ok: true,
      courseId: newCourseId,
      assignmentsCreated,
    });
  } catch (err) {
    console.error("[upload/confirm]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
