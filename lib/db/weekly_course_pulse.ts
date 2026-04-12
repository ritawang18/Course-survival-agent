import { getServiceClient } from "@/lib/supabase/server";
import type {
  WeeklyCoursePulse,
  WeeklyCoursePulseRecord,
  WeeklyCoursePulseSourceSummary,
} from "@/lib/schemas/weekly-course-pulse";

export interface WeeklyCoursePulseUpsertInput {
  courseUuid: string;
  courseId: string;
  courseName: string | null;
  anchorDate: string;
  pastWindowStart: string;
  pastWindowEnd: string;
  futureWindowStart: string;
  futureWindowEnd: string;
  generatedAt: string;
  model: string | null;
  sourceSummary: WeeklyCoursePulseSourceSummary;
  pulse: WeeklyCoursePulse;
  rawContext?: unknown;
}

interface WeeklyCoursePulseRow {
  course_uuid: string;
  course_id: string;
  course_name: string | null;
  anchor_date: string;
  past_window_start: string;
  past_window_end: string;
  future_window_start: string;
  future_window_end: string;
  generated_at: string;
  model: string | null;
  source_summary: WeeklyCoursePulseSourceSummary | null;
  past_week_learned: string;
  next_week_preview: string;
  past_week_evidence: WeeklyCoursePulse["pastWeekEvidence"] | null;
  next_week_evidence: WeeklyCoursePulse["nextWeekEvidence"] | null;
  confidence: number | null;
  raw_context: unknown;
}

function mapRowToRecord(row: WeeklyCoursePulseRow): WeeklyCoursePulseRecord {
  return {
    courseUuid: row.course_uuid,
    courseId: row.course_id,
    courseName: row.course_name,
    anchorDate: row.anchor_date,
    pastWindowStart: row.past_window_start,
    pastWindowEnd: row.past_window_end,
    futureWindowStart: row.future_window_start,
    futureWindowEnd: row.future_window_end,
    generatedAt: row.generated_at,
    model: row.model,
    sourceSummary: row.source_summary ?? {
      hasDatabaseContext: false,
      hasCanvasApiContext: false,
    },
    pulse: {
      pastWeekLearned: row.past_week_learned,
      nextWeekPreview: row.next_week_preview,
      pastWeekEvidence: row.past_week_evidence ?? [],
      nextWeekEvidence: row.next_week_evidence ?? [],
      confidence: row.confidence ?? 0,
    },
    rawContext: row.raw_context,
  };
}

export async function getWeeklyCoursePulse(
  courseUuid: string,
  anchorDate: string
): Promise<WeeklyCoursePulseRecord | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("weekly_course_pulse")
    .select(
      [
        "course_uuid",
        "course_id",
        "course_name",
        "anchor_date",
        "past_window_start",
        "past_window_end",
        "future_window_start",
        "future_window_end",
        "generated_at",
        "model",
        "source_summary",
        "past_week_learned",
        "next_week_preview",
        "past_week_evidence",
        "next_week_evidence",
        "confidence",
        "raw_context",
      ].join(", ")
    )
    .eq("course_uuid", courseUuid)
    .eq("anchor_date", anchorDate)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`getWeeklyCoursePulse failed: ${error.message}`);
  }

  return data ? mapRowToRecord(data as WeeklyCoursePulseRow) : null;
}

export async function upsertWeeklyCoursePulse(
  input: WeeklyCoursePulseUpsertInput
): Promise<WeeklyCoursePulseRecord> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("weekly_course_pulse")
    .upsert(
      {
        course_uuid: input.courseUuid,
        course_id: input.courseId,
        course_name: input.courseName,
        anchor_date: input.anchorDate,
        past_window_start: input.pastWindowStart,
        past_window_end: input.pastWindowEnd,
        future_window_start: input.futureWindowStart,
        future_window_end: input.futureWindowEnd,
        generated_at: input.generatedAt,
        model: input.model,
        source_summary: input.sourceSummary,
        past_week_learned: input.pulse.pastWeekLearned,
        next_week_preview: input.pulse.nextWeekPreview,
        past_week_evidence: input.pulse.pastWeekEvidence,
        next_week_evidence: input.pulse.nextWeekEvidence,
        confidence: input.pulse.confidence,
        raw_context: input.rawContext ?? null,
      },
      { onConflict: "course_uuid,anchor_date" }
    )
    .select(
      [
        "course_uuid",
        "course_id",
        "course_name",
        "anchor_date",
        "past_window_start",
        "past_window_end",
        "future_window_start",
        "future_window_end",
        "generated_at",
        "model",
        "source_summary",
        "past_week_learned",
        "next_week_preview",
        "past_week_evidence",
        "next_week_evidence",
        "confidence",
        "raw_context",
      ].join(", ")
    )
    .single();

  if (error) {
    throw new Error(`upsertWeeklyCoursePulse failed: ${error.message}`);
  }

  return mapRowToRecord(data as WeeklyCoursePulseRow);
}
