import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseSyllabus } from "@/lib/parsers/syllabus";
import { parseAssignment } from "@/lib/parsers/assignment";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
import { upsertSyllabus, upsertCourse } from "@/lib/db/courses";
import { insertSyllabusAssignments, insertAssignment } from "@/lib/db/assignments";
import { compileAndStoreGradePolicy } from "@/lib/skills/grade-policy-compiler";
import { requireAIConfig } from "@/lib/ai/client";

export const runtime = "nodejs"; // pdf-parse requires Node.js runtime

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const aiConfig = await requireAIConfig(user.id);
    const form = await req.formData();
    const file = form.get("file");
    const kind = (form.get("kind") as string) ?? "syllabus"; // "syllabus" | "assignment"
    // For assignment uploads the frontend must include the course_id
    const courseId = form.get("course_id") as string | null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file as File).name;

    // ── Extract raw text ────────────────────────────────────────────────────
    let rawText = "";
    if (fileName.toLowerCase().endsWith(".pdf")) {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        rawText = result.text;
      } finally {
        await parser.destroy();
      }
    } else {
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. Is it a scanned image PDF?" },
        { status: 422 }
      );
    }

    // ── Assignment upload (parse only — no DB writes) ────────────────────
    if (kind === "assignment") {
      if (!courseId) {
        return NextResponse.json(
          { error: "course_id is required for assignment uploads" },
          { status: 400 }
        );
      }

      const result = await parseAssignment(rawText, {
        provider: aiConfig.provider,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
      });
      console.log(
        "[upload] parseAssignment result:\n" +
          JSON.stringify(result, null, 2)
      );

      return NextResponse.json({
        kind,
        fileName,
        courseId,
        extracted: {
          deadlines: result.dueDate
            ? [{ label: result.title ?? "Due date", date: result.dueDate, confidence: 0.9 }]
            : [],
          weights: [],
          examDates: [],
          cutoffs: [],
          attendancePolicy: { text: "", confidence: 0 },
          assignment: result,
        },
      });
    }

    // ── Syllabus upload (parse only — no DB writes) ─────────────────────
    const result = await parseSyllabus(rawText, {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
    });
    console.log(
      "[upload] parseSyllabus result:\n" +
        JSON.stringify(result, null, 2)
    );

    return NextResponse.json({
      kind,
      fileName,
      extracted: {
        deadlines: result.deadlines,
        weights: result.weights,
        examDates: result.examDates,
        cutoffs: result.cutoffs,
        attendancePolicy: result.attendancePolicy,
        courseCode: result.courseCode,
        courseName: result.courseName,
        instructor: result.instructor,
        gradingPolicy: result.gradingPolicy,
      },
    });
  } catch (err) {
    console.error("[upload]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
