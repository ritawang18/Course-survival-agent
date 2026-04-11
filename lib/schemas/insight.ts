import { z } from "zod";

export const SentimentSchema = z.enum([
  "positive",
  "mixed",
  "negative",
  "unavailable",
]);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const RmpInsightSchema = z.object({
  score: z.number().min(0).max(5),
  sentiment: SentimentSchema,
  summary: z.string(),
  quotes: z.array(z.string()),
  tags: z.array(z.string()),
});
export type RmpInsight = z.infer<typeof RmpInsightSchema>;

export const RedditInsightSchema = z.object({
  sentiment: SentimentSchema,
  summary: z.string(),
  quotes: z.array(z.string()),
  tags: z.array(z.string()),
});
export type RedditInsight = z.infer<typeof RedditInsightSchema>;

export const InstructorInsightSchema = z.object({
  courseId: z.string().optional(),
  professorName: z.string(),
  universityName: z.string(),
  generatedAt: z.string().optional(),
  rmp: RmpInsightSchema.nullable(),
  reddit: RedditInsightSchema.nullable(),
});
export type InstructorInsight = z.infer<typeof InstructorInsightSchema>;

/**
 * Schema used for the `generateObject` call. Excludes fields the route
 * handler fills in (courseId, generatedAt, professorName, universityName)
 * so the model only has to produce the interesting parts.
 */
export const InsightGenerationSchema = z.object({
  rmp: RmpInsightSchema.nullable(),
  reddit: RedditInsightSchema.nullable(),
});
export type InsightGeneration = z.infer<typeof InsightGenerationSchema>;
