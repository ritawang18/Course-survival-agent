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

export const RmpSourceSchema = z.object({
  professorName: z.string().optional(),
  schoolName: z.string().optional(),
  score: z.number().optional(),
  numRatings: z.number().optional(),
  wouldTakeAgain: z.number().nullable().optional(),
  difficulty: z.number().nullable().optional(),
  recentComments: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  profileUrl: z.string().nullable().optional(),
});
export type RmpSource = z.infer<typeof RmpSourceSchema>;

export const RedditPostSourceSchema = z.object({
  title: z.string(),
  body: z.string(),
  subreddit: z.string(),
  score: z.number(),
  numComments: z.number(),
  url: z.string(),
  permalink: z.string(),
  createdUtc: z.number(),
});
export type RedditPostSource = z.infer<typeof RedditPostSourceSchema>;

export const RedditSourceSchema = z.object({
  posts: z.array(RedditPostSourceSchema),
  totalSeen: z.number(),
});
export type RedditSource = z.infer<typeof RedditSourceSchema>;

export const InsightSourcesSchema = z.object({
  rmp: RmpSourceSchema.nullable().optional(),
  reddit: RedditSourceSchema.nullable().optional(),
});
export type InsightSources = z.infer<typeof InsightSourcesSchema>;

export const InstructorInsightSchema = z.object({
  courseId: z.string().optional(),
  professorName: z.string(),
  universityName: z.string(),
  generatedAt: z.string().optional(),
  rmp: RmpInsightSchema.nullable(),
  reddit: RedditInsightSchema.nullable(),
  sources: InsightSourcesSchema.optional(),
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
