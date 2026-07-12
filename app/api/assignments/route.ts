import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { z } from "zod";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";
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
 *   difficulty       "easy" | "medium" | "hard" — optional (parser fills in if PDF provided)
 *   weight           number — optional, % of final grade this assignment is worth
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
    const difficultyManual = (form.get("difficulty") as string | null)?.trim() || null;
    const weightRaw      = (form.get("weight") as string | null)?.trim() || null;
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
      difficulty:          (difficultyManual as "easy" | "medium" | "hard" | null) ?? parsed?.difficulty ?? "medium",
      questions:           parsed?.questions ?? [],
      conceptDependencies: parsed?.conceptDependencies ?? [],
      implicitRequirements: parsed?.implicitRequirements ?? [],
      // Override assignment_type if manually set
      ...(typeManual ? { _typeOverride: typeManual } : {}),
    });

    // Patch type, status, and weight after insert (weight isn't part of the parser flow)
    const patch: Record<string, string | number> = {};
    if (typeManual)   patch.assignment_type = typeManual;
    if (statusManual) patch.status          = statusManual;
    if (weightRaw && !isNaN(Number(weightRaw))) patch.weight = Number(weightRaw);

    if (Object.keys(patch).length > 0 && assignmentId) {
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

const PatchSchema = z.object({
  assignmentId: z.string().uuid(),
  status: z.enum(["not_started", "in_progress", "done", "overdue"]),
});

/**
 * PATCH /api/assignments
 *
 * Body: { assignmentId: string, status: "not_started" | "in_progress" | "done" | "overdue" }
 * Used to persist status changes (e.g. "Mark as complete") made in the UI.
 */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify the assignment belongs to a course owned by this user before updating.
  const { data: assignmentRow, error: lookupError } = await supabase
    .from("assignments")
    .select("id, course_id")
    .eq("id", body.assignmentId)
    .single();

  if (lookupError || !assignmentRow) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { data: courseRow, error: courseError } = await supabase
    .from("courses")
    .select("id")
    .eq("id", assignmentRow.course_id as string)
    .eq("user_id", user.id)
    .single();

  if (courseError || !courseRow) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("assignments")
    .update({ status: body.status })
    .eq("id", body.assignmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
