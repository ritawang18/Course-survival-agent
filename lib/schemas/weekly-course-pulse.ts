import { z } from "zod";

export const WeeklyPulseSourceSchema = z.enum([
  "syllabus",
  "canvas_api",
  "database",
  "planner",
  "inferred",
]);
export type WeeklyPulseSource = z.infer<typeof WeeklyPulseSourceSchema>;

export const WeeklyPulseEvidenceItemSchema = z.object({
  label: z.string(),
  detail: z.string(),
  source: WeeklyPulseSourceSchema,
});
export type WeeklyPulseEvidenceItem = z.infer<typeof WeeklyPulseEvidenceItemSchema>;

export const WeeklyCoursePulseSchema = z.object({
  pastWeekLearned: z.string(),
  nextWeekPreview: z.string(),
  pastWeekEvidence: z.array(WeeklyPulseEvidenceItemSchema).max(8),
  nextWeekEvidence: z.array(WeeklyPulseEvidenceItemSchema).max(8),
  confidence: z.number().min(0).max(1),
});
export type WeeklyCoursePulse = z.infer<typeof WeeklyCoursePulseSchema>;

/**
 * Schema used for LLM generation. Excludes metadata the caller fills in,
 * such as course ids, week boundaries, and timestamps.
 */
export const WeeklyCoursePulseGenerationSchema = WeeklyCoursePulseSchema;

export const WeeklyCoursePulseSourceSummarySchema = z.object({
  hasDatabaseContext: z.boolean(),
  hasCanvasApiContext: z.boolean(),
});
export type WeeklyCoursePulseSourceSummary = z.infer<typeof WeeklyCoursePulseSourceSummarySchema>;

export const WeeklyCoursePulseRecordSchema = z.object({
  courseUuid: z.string(),
  courseId: z.string(),
  courseName: z.string().nullable(),
  anchorDate: z.string(),
  pastWindowStart: z.string(),
  pastWindowEnd: z.string(),
  futureWindowStart: z.string(),
  futureWindowEnd: z.string(),
  generatedAt: z.string(),
  model: z.string().nullable(),
  sourceSummary: WeeklyCoursePulseSourceSummarySchema,
  pulse: WeeklyCoursePulseSchema,
  rawContext: z.unknown().optional(),
});
export type WeeklyCoursePulseRecord = z.infer<typeof WeeklyCoursePulseRecordSchema>;
