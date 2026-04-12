import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getUserFromRequest } from "@/lib/supabase/server";
import { parseAssignment } from "@/lib/parsers/assignment";
import { insertAssignment } from "@/lib/db/assignments";

export const runtime = "nodejs";

/**
 * POST /api/assignments
 *
 * Creates a new assignment, optionally parsing an uploaded PDF for defaults.
 * Manual fields always take precedence over parsed values.
 *
 * Form fields (multipart/form-data):
 *   course_id        uuid — required
 *   due_at           ISO string — required
 *   points_possible  number — required
 *   title            string — optional (parser fills in if PDF provided)
 *   assignment_type  string — optional (inferred if blank)
 *   file             PDF — optional
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const courseId       = form.get("course_id") as string | null;
    const dueAt          = form.get("due_at") as string | null;
    const pointsRaw      = form.get("points_possible") as string | null;
    const titleManual    = (form.get("title") as string | null)?.trim() || null;
    const typeManual     = (form.get("assignment_type") as string | null)?.trim() || null;
    const statusManual   = (form.get("status") as string | null)?.trim() || "not_started";
    const file           = form.get("file");

    if (!courseId) {
      return NextResponse.json({ error: "course_id is required" }, { status: 400 });
    }
    if (!dueAt) {
      return NextResponse.json({ error: "due_at is required" }, { status: 400 });
    }
    if (!pointsRaw || isNaN(Number(pointsRaw))) {
      return NextResponse.json({ error: "points_possible is required" }, { status: 400 });
    }

    // Parse PDF if provided
    let parsed = null;
    if (file && typeof file !== "string") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = (file as File).name.toLowerCase();
      if (fileName.endsWith(".pdf")) {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        try {
          const result = await parser.getText();
          if (result.text.trim()) {
            parsed = await parseAssignment(result.text);
          }
        } finally {
          await parser.destroy();
        }
      }
    }

    // Manual fields override parsed values
    const assignmentId = await insertAssignment(courseId, {
      title:               titleManual ?? parsed?.title ?? null,
      totalPoints:         Number(pointsRaw),
      dueDate:             dueAt,
      estimatedHours:      parsed?.estimatedHours ?? 1,
      difficulty:          parsed?.difficulty ?? "medium",
      questions:           parsed?.questions ?? [],
      conceptDependencies: parsed?.conceptDependencies ?? [],
      implicitRequirements: parsed?.implicitRequirements ?? [],
      // Override assignment_type if manually set
      ...(typeManual ? { _typeOverride: typeManual } : {}),
    });

    // Patch type and status after insert
    const patch: Record<string, string> = {};
    if (typeManual)   patch.assignment_type = typeManual;
    if (statusManual) patch.status          = statusManual;

    if (Object.keys(patch).length > 0 && assignmentId) {
      const { getServiceClient } = await import("@/lib/supabase/server");
      const supabase = getServiceClient();
      await supabase.from("assignments").update(patch).eq("id", assignmentId);
    }

    return NextResponse.json({ assignmentId, parsedFromFile: !!parsed });
  } catch (err) {
    console.error("[assignments/create]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
