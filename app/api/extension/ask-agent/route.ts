import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import {
  buildAskAgentContext,
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
  context: ContextSchema,
  question: z.string().min(1).max(1000)
});

function fallbackAnswer(question: string, summaryText: string) {
  return {
    answer: `Question: ${question}\n\nBest local answer: ${summaryText}`,
    followups: [
      "What should I do next on this page?",
      "What is the highest-risk item here?"
    ]
  };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { context, question } = RequestSchema.parse(json) as {
      context: ExtensionCanvasContext;
      question: string;
    };

    const { summary, matchedCourse, assignmentRequirements } = await buildAskAgentContext(context);

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        fallbackAnswer(question, summary.pageSummary)
      );
    }

    const result = await generateText({
      model: anthropic("claude-sonnet-4-5"),
      system:
        "You are Course Survival Agent, a concise student-support assistant inside Canvas. " +
        "Answer only from the provided context and database summary. " +
        "Be practical, page-aware, and concrete. Prefer 3-6 sentences or short bullets. " +
        "If information is missing, say what is missing instead of inventing it.",
      prompt: JSON.stringify({
        question,
        context: summary.context,
        pageSummary: summary.pageSummary,
        alerts: summary.alerts,
        checklist: summary.checklist,
        courseSnapshot: summary.courseSnapshot,
        assignmentSnapshot: summary.assignmentSnapshot,
        matchedCourse,
        assignmentRequirements
      })
    });

    return NextResponse.json({
      answer: result.text.trim(),
      followups: summary.promptSuggestions
    });
  } catch (error) {
    console.error("[extension/ask-agent]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        answer: `I could not generate a backend answer right now. ${message}`,
        followups: [
          "What should I focus on next?",
          "What risks should I watch?"
        ]
      },
      { status: 200 }
    );
  }
}
