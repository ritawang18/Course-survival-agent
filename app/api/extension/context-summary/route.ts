import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildExtensionContextSummary,
  type ExtensionCanvasContext
} from "@/lib/extension/context";

export const runtime = "nodejs";

const ContextSchema = z.object({
  url: z.string(),
  origin: z.string(),
  pathname: z.string(),
  pageType: z.enum(["dashboard", "course_home", "assignment", "module", "syllabus", "files", "grades", "unknown"]),
  courseId: z.string().optional(),
  assignmentId: z.string().optional(),
  moduleItemId: z.string().optional(),
  courseName: z.string().optional(),
  courseCode: z.string().optional(),
  pageTitle: z.string().optional(),
  detectedDueText: z.string().optional(),
  detectedPointsText: z.string().optional(),
  detectedSubmissionTypeText: z.string().optional(),
  rubricDetected: z.boolean(),
  fileRestrictionsDetected: z.boolean(),
  peerReviewDetected: z.boolean(),
  mustViewDetected: z.boolean(),
  modulePrerequisiteDetected: z.boolean(),
  latePolicyText: z.string().optional(),
  attendancePolicyText: z.string().optional(),
  gradingWeightsText: z.string().optional(),
  examDatesText: z.string().optional(),
  folderName: z.string().optional(),
  nearestDueText: z.string().optional(),
  dashboardDeadlines: z.array(z.string()),
  modulePastSummary: z.string().optional(),
  moduleNextSummary: z.string().optional(),
  rawDomHints: z.array(z.string()),
  detectedAt: z.string()
});

const RequestSchema = z.object({
  context: ContextSchema
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { context } = RequestSchema.parse(json) as { context: ExtensionCanvasContext };
    const summary = await buildExtensionContextSummary(context);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[extension/context-summary]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
