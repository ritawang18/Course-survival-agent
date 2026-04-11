import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { parseSyllabus } from "@/lib/parsers/syllabus";
import { parseAssignment } from "@/lib/parsers/assignment";

export const runtime = "nodejs"; // pdf-parse requires Node.js runtime

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const kind = (form.get("kind") as string) ?? "syllabus"; // "syllabus" | "notes" | "assignment"

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
      // Plain text fallback (.txt, .md)
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file. Is it a scanned image PDF?" },
        { status: 422 }
      );
    }

    // ── AI extraction ───────────────────────────────────────────────────────
    if (kind === "assignment") {
      const result = await parseAssignment(rawText);
      return NextResponse.json({
        kind,
        fileName,
        pages: rawText.length, // approximate
        extracted: {
          // Map to the UploadArtifact shape the frontend expects
          deadlines: result.dueDate
            ? [{ label: result.title ?? "Due date", date: result.dueDate, confidence: 0.9 }]
            : [],
          weights: [],
          examDates: [],
          attendancePolicy: { text: "", confidence: 0 },
          // Extra assignment-specific fields
          assignment: result,
        },
      });
    }

    // syllabus or notes
    const result = await parseSyllabus(rawText);
    return NextResponse.json({
      kind,
      fileName,
      pages: rawText.length,
      extracted: {
        deadlines: result.deadlines,
        weights: result.weights,
        examDates: result.examDates,
        attendancePolicy: result.attendancePolicy,
        // Extra syllabus-specific fields
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
