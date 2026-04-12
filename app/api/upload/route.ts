import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseSyllabus } from "@/lib/parsers/syllabus";
import { parseAssignment } from "@/lib/parsers/assignment";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
import { upsertSyllabus, upsertCourse } from "@/lib/db/courses";
import { insertSyllabusAssignments, insertAssignment } from "@/lib/db/assignments";
import { compileAndStoreGradePolicy } from "@/lib/skills/grade-policy-compiler";

export const runtime = "nodejs"; // pdf-parse requires Node.js runtime

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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

    // ── Assignment upload ───────────────────────────────────────────────────
    if (kind === "assignment") {
      if (!courseId) {
        return NextResponse.json(
          { error: "course_id is required for assignment uploads" },
          { status: 400 }
        );
      }

      const result = await parseAssignment(rawText);
      const assignmentId = await insertAssignment(courseId, result);

      return NextResponse.json({
        kind,
        fileName,
        assignmentId,
        extracted: {
          deadlines: result.dueDate
            ? [{ label: result.title ?? "Due date", date: result.dueDate, confidence: 0.9 }]
            : [],
          weights: [],
          examDates: [],
          attendancePolicy: { text: "", confidence: 0 },
          assignment: result,
        },
      });
    }

    // ── Syllabus upload ─────────────────────────────────────────────────────
    const result = await parseSyllabus(rawText);

    // syllabus must be inserted first (courses.course_id FK references syllabus.course_id)
    const syllabusId = await upsertSyllabus(result);
    const newCourseId = await upsertCourse(user.id, syllabusId, result);
    const assignmentsCreated = await insertSyllabusAssignments(newCourseId, result);

    // Compile grading policy into executable code and cache it in syllabus.grading_code.
    // grading_policy is populated by the partner's parser; skip silently if absent.
    try {
      const supabase = getServiceClient();
      const { data: syllabusRow } = await supabase
        .from("syllabus")
        .select("grading_policy")
        .eq("course_id", syllabusId)
        .single();

      if (syllabusRow?.grading_policy) {
        await compileAndStoreGradePolicy(syllabusId, syllabusRow.grading_policy);
      }
    } catch (compileErr) {
      // Non-fatal: grade calculation falls back to default policy if compilation fails
      console.warn("[upload] grade policy compilation skipped:", compileErr);
    }

    return NextResponse.json({
      kind,
      fileName,
      courseId: newCourseId,
      assignmentsCreated,
      extracted: {
        deadlines: result.deadlines,
        weights: result.weights,
        examDates: result.examDates,
        attendancePolicy: result.attendancePolicy,
        courseCode: result.courseCode,
        courseName: result.courseName,
        instructor: result.instructor,
      },
    });
  } catch (err) {
    console.error("[upload]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
