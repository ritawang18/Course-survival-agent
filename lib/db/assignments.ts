import { getServiceClient } from "@/lib/supabase/server";
import type { SyllabusParseResult } from "@/lib/parsers/syllabus";
import type { AssignmentParseResult } from "@/lib/parsers/assignment";

/**
 * Insert exam dates and deadlines from a parsed syllabus as assignment rows.
 * Skips items below 0.7 confidence.
 * Returns the number of rows inserted.
 */
export async function insertSyllabusAssignments(
  courseUuid: string,
  syllabus: SyllabusParseResult
): Promise<number> {
  const supabase = getServiceClient();
  const rows = [];

  for (const exam of syllabus.examDates) {
    if (exam.confidence < 0.7) continue;
    rows.push({
      course_id: courseUuid,
      title: exam.label,
      assignment_type: "exam",
      due_at: exam.date,
      status: "not_started",
    });
  }

  for (const deadline of syllabus.deadlines) {
    if (deadline.confidence < 0.7) continue;
    rows.push({
      course_id: courseUuid,
      title: deadline.label,
      assignment_type: inferAssignmentType(deadline.label),
      due_at: deadline.date,
      status: "not_started",
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("assignments").insert(rows);
  if (error) throw new Error(`insertSyllabusAssignments failed: ${error.message}`);
  return rows.length;
}

/**
 * Insert a parsed assignment (from an assignment PDF upload).
 * Returns the created assignment uuid.
 */
export async function insertAssignment(
  courseUuid: string,
  parsed: AssignmentParseResult
): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      course_id: courseUuid,
      title: parsed.title ?? "Untitled Assignment",
      assignment_type: inferAssignmentType(parsed.title ?? ""),
      due_at: parsed.dueDate,
      points_possible: parsed.totalPoints,
      estimated_hours: parsed.estimatedHours,
      description: parsed.implicitRequirements.length > 0
        ? `Implicit requirements:\n${parsed.implicitRequirements.join("\n")}`
        : null,
      dependencies: parsed.conceptDependencies.map((d) => d.concept),
      difficulty: parsed.difficulty,
      status: "not_started",
    })
    .select("id")
    .single();

  if (error) throw new Error(`insertAssignment failed: ${error.message}`);
  return data.id as string;
}

// ── Helper ────────────────────────────────────────────────────────────────────

/** Infer assignment_type from a title string. */
function inferAssignmentType(title: string): string {
  const t = title.toLowerCase();
  if (/exam|midterm|final/.test(t))   return "exam";
  if (/quiz/.test(t))                  return "quiz";
  if (/project/.test(t))               return "project";
  if (/lab/.test(t))                   return "lab";
  if (/essay|paper|report/.test(t))    return "essay";
  return "homework";
}
