import { getServiceClient } from "@/lib/supabase/server";

interface StudyPlanBlock {
  courseUuid: string;    // DB uuid — used as the row id (one-to-one FK with courses)
  courseId: string;      // text course_id (e.g. "CS61A")
  title: string;
  type: string;
  priority: string;
  difficulty: string;
}

/**
 * Upsert study plan rows into the study_plan table.
 * One row per course (study_plan.id is a one-to-one FK to courses.id).
 * Each upsert replaces the previous plan for that course.
 */
export async function upsertStudyPlan(blocks: StudyPlanBlock[]): Promise<void> {
  if (blocks.length === 0) return;

  const supabase = getServiceClient();

  const rows = blocks.map((b) => ({
    id: b.courseUuid,
    course_id: b.courseId,
    title: b.title,
    type: b.type,
    priority: b.priority,
    difficulty: b.difficulty,
  }));

  const { error } = await supabase
    .from("study_plan")
    .upsert(rows, { onConflict: "id" });

  if (error) throw new Error(`upsertStudyPlan failed: ${error.message}`);
}
