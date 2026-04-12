import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, getServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * PATCH /api/attendance
 *
 * Body: { courseId: string, attended?: boolean, action?: "decrement" }
 *
 * Updates attendance counts on the courses table.
 * - attended=true  → increment attendance_attended_count
 * - attended=false → increment attendance_missed_count
 * - action="decrement" → decrement attendance_missed_count (min 0)
 */
export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { courseId, attended, action } = body as {
    courseId: string;
    attended?: boolean;
    action?: "decrement" | "undo_attended";
  };

  if (!courseId) {
    return NextResponse.json({ error: "courseId is required" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Verify the course belongs to this user
  // Only select columns guaranteed to exist; attendance columns may not be in
  // PostgREST's schema cache yet, which would fail the entire query.
  const { data: course, error: lookupErr } = await supabase
    .from("courses")
    .select("id, attendance_missed_count")
    .eq("id", courseId)
    .eq("user_id", user.id)
    .single();

  if (lookupErr || !course) {
    console.error("[attendance] course lookup failed:", lookupErr?.message, { courseId, userId: user.id });
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Fetch attendance_attended_count separately — column may not exist in schema cache
  let currentAttended = 0;
  const { data: attendedRow, error: attendedErr } = await supabase
    .from("courses")
    .select("attendance_attended_count")
    .eq("id", courseId)
    .single();
  if (!attendedErr && attendedRow) {
    currentAttended = (attendedRow as Record<string, unknown>).attendance_attended_count as number ?? 0;
  }
  const currentMissed = course.attendance_missed_count ?? 0;

  // Decrement missed (undo)
  if (action === "decrement") {
    const newMissed = Math.max(0, currentMissed - 1);
    const { error: updateErr } = await supabase
      .from("courses")
      .update({ attendance_missed_count: newMissed })
      .eq("id", courseId);

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update attendance: ${updateErr.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, attendance_missed_count: newMissed });
  }

  // Undo attended (decrement attended count)
  if (action === "undo_attended") {
    const newAttended = Math.max(0, currentAttended - 1);
    const { error: updateErr } = await supabase
      .from("courses")
      .update({ attendance_attended_count: newAttended } as Record<string, unknown>)
      .eq("id", courseId);

    if (updateErr) {
      console.warn("[attendance] undo attended update failed:", updateErr.message);
    }
    return NextResponse.json({ ok: true, attendance_attended_count: newAttended });
  }

  // "I went today" → increment attended
  if (attended) {
    const newAttended = currentAttended + 1;
    // Try with attendance_attended_count column, fall back if it doesn't exist
    const { error: updateErr } = await supabase
      .from("courses")
      .update({ attendance_attended_count: newAttended } as Record<string, unknown>)
      .eq("id", courseId);

    if (updateErr) {
      // Column may not exist yet — log but don't fail
      console.warn("[attendance] attended count update failed:", updateErr.message);
    }
    return NextResponse.json({ ok: true, attendance_attended_count: newAttended });
  }

  // "Missed" → increment missed
  const newMissed = currentMissed + 1;
  const { error: updateErr } = await supabase
    .from("courses")
    .update({ attendance_missed_count: newMissed })
    .eq("id", courseId);

  if (updateErr) {
    return NextResponse.json(
      { error: `Failed to update attendance: ${updateErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, attendance_missed_count: newMissed });
}
