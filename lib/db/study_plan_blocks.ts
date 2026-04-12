import { getServiceClient } from "@/lib/supabase/server";

interface StudyPlanBlockRowInput {
  courseUuid: string;
  courseId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  type: string;
  priority?: string | null;
  difficulty?: string | null;
  conflict?: boolean;
}

function isMissingTableError(message: string) {
  return /does not exist|schema cache|relation .* does not exist/i.test(message);
}

export async function replaceStudyPlanBlocks(
  courseUuids: string[],
  blocks: StudyPlanBlockRowInput[]
): Promise<void> {
  if (courseUuids.length === 0) return;

  const supabase = getServiceClient();

  const { error: deleteError } = await supabase
    .from("study_plan_blocks")
    .delete()
    .in("course_uuid", courseUuids);

  if (deleteError) {
    if (isMissingTableError(deleteError.message)) {
      console.warn(`[study_plan_blocks] table unavailable: ${deleteError.message}`);
      return;
    }
    throw new Error(`replaceStudyPlanBlocks delete failed: ${deleteError.message}`);
  }

  if (blocks.length === 0) return;

  const rows = blocks.map((block) => ({
    course_uuid: block.courseUuid,
    course_id: block.courseId,
    title: block.title,
    date: block.date,
    start_time: block.start,
    end_time: block.end,
    type: block.type,
    priority: block.priority ?? null,
    difficulty: block.difficulty ?? null,
    conflict: block.conflict ?? false,
    updated_at: new Date().toISOString(),
  }));

  const { error: insertError } = await supabase
    .from("study_plan_blocks")
    .insert(rows);

  if (insertError) {
    if (isMissingTableError(insertError.message)) {
      console.warn(`[study_plan_blocks] table unavailable: ${insertError.message}`);
      return;
    }
    throw new Error(`replaceStudyPlanBlocks insert failed: ${insertError.message}`);
  }
}
