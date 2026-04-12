import { z } from "zod";

export const DashboardWeeklyOverviewCourseHighlightSchema = z.object({
  courseId: z.string(),
  label: z.string(),
  reason: z.string(),
});

export const DashboardWeeklyOverviewSchema = z.object({
  anchorDate: z.string(),
  generatedAt: z.string(),
  model: z.string().nullable(),
  pastWeekOverview: z.string(),
  nextWeekOverview: z.string(),
  courseHighlights: z.array(DashboardWeeklyOverviewCourseHighlightSchema).max(4),
  confidence: z.number().min(0).max(1),
});

export type DashboardWeeklyOverview = z.infer<typeof DashboardWeeklyOverviewSchema>;
