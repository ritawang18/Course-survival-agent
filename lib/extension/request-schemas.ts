import { z } from "zod";

const PAGE_TYPES = [
  "dashboard",
  "course_home",
  "assignment",
  "module",
  "syllabus",
  "files",
  "grades",
  "unknown",
] as const;

function toOptionalString(value: unknown) {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  return String(value);
}

function toRequiredString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value);
}

const nullishString = z.preprocess(toOptionalString, z.string().optional());
const tolerantString = z.preprocess(toRequiredString, z.string());
const tolerantBoolean = z.preprocess(
  (value) => (value == null ? false : value),
  z.boolean()
);
const tolerantStringArray = z.preprocess(
  (value) => (value == null ? [] : value),
  z.array(z.string())
);

export const ExtensionContextSchema = z.object({
  url: tolerantString.default(""),
  origin: tolerantString.default(""),
  pathname: tolerantString.default(""),
  pageType: z
    .preprocess(
      (value) => (value == null || value === "" ? "unknown" : value),
      z.enum(PAGE_TYPES)
    )
    .default("unknown"),
  courseId: nullishString,
  assignmentId: nullishString,
  moduleItemId: nullishString,
  courseName: nullishString,
  courseCode: nullishString,
  pageTitle: nullishString,
  detectedDueText: nullishString,
  detectedPointsText: nullishString,
  detectedSubmissionTypeText: nullishString,
  rubricDetected: tolerantBoolean.default(false),
  fileRestrictionsDetected: tolerantBoolean.default(false),
  peerReviewDetected: tolerantBoolean.default(false),
  mustViewDetected: tolerantBoolean.default(false),
  modulePrerequisiteDetected: tolerantBoolean.default(false),
  latePolicyText: nullishString,
  attendancePolicyText: nullishString,
  gradingWeightsText: nullishString,
  examDatesText: nullishString,
  folderName: nullishString,
  nearestDueText: nullishString,
  dashboardDeadlines: tolerantStringArray.default([]),
  modulePastSummary: nullishString,
  moduleNextSummary: nullishString,
  rawDomHints: tolerantStringArray.default([]),
  detectedAt: z
    .preprocess(
      (value) =>
        value == null || value === "" ? new Date().toISOString() : value,
      z.string()
    )
    .default(new Date().toISOString()),
});

export const ExtensionContextSummaryRequestSchema = z.object({
  context: ExtensionContextSchema,
});

export const ExtensionAskAgentRequestSchema = z.object({
  context: ExtensionContextSchema,
  question: z.string().trim().min(1).max(1000),
});
