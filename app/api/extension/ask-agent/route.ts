import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildAskAgentContext,
  type ExtensionCanvasContext
} from "@/lib/extension/context";
import { ExtensionAskAgentRequestSchema } from "@/lib/extension/request-schemas";
import { generateTextWithAI, resolveAIConfig } from "@/lib/ai/client";
import { getUserFromRequest } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { context, question } = ExtensionAskAgentRequestSchema.parse(json) as {
      context: ExtensionCanvasContext;
      question: string;
    };

    const { summary, matchedCourse, assignmentRequirements } = await buildAskAgentContext(context, user.id);

    const aiConfig = await resolveAIConfig(user.id);
    if (!aiConfig) {
      return NextResponse.json(
        fallbackAnswer(question, summary.pageSummary)
      );
    }

    const result = await generateTextWithAI({
      config: aiConfig,
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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("[extension/ask-agent]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
