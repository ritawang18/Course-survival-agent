import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { formatISO } from "date-fns";
import { getUserFromRequest } from "@/lib/supabase/server";
import { requireAIConfig, generateObjectWithAI } from "@/lib/ai/client";
import { DashboardWeeklyOverviewSchema } from "@/lib/schemas/dashboard-weekly-overview";

export const runtime = "nodejs";

const MinimalCoursePulseSchema = z.object({
  pulse: z.object({
    pastWeekLearned: z.string(),
    nextWeekPreview: z.string(),
    confidence: z.number(),
  }),
}).passthrough();

const RequestSchema = z.object({
  courses: z.array(
    z.object({
      id: z.string(),
      code: z.string().optional(),
      name: z.string().optional(),
      course_id: z.string().optional(),
      course_name: z.string().optional(),
      current_grade_percent: z.number().optional(),
      weeklyPulse: MinimalCoursePulseSchema.optional(),
    })
  ),
  assignments: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      due_at: z.string().optional(),
      status: z.string().optional(),
      assignment_type: z.string().optional(),
    })
  ),
  exams: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      date: z.string(),
      weight: z.number().optional(),
    })
  ),
  studyBlocks: z.array(
    z.object({
      course_id: z.string(),
      title: z.string(),
      date: z.string(),
      start: z.string(),
      end: z.string(),
      type: z.string(),
    })
  ),
});

function toMostRecentFriday(input: Date) {
  const next = new Date(input);
  const day = next.getDay();
  const distance = (day + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = RequestSchema.parse(await request.json());
    const aiConfig = await requireAIConfig(user.id);
    const anchorDate = formatISO(toMostRecentFriday(new Date()), { representation: "date" });

    const result = await generateObjectWithAI({
      config: aiConfig,
      schema: DashboardWeeklyOverviewSchema.omit({
        anchorDate: true,
        generatedAt: true,
        model: true,
      }),
      maxOutputTokens: 3000,
      system:
        "You generate a dashboard-wide weekly overview for a student support system. " +
        "This is cross-course and semester-level, not course-specific. " +
        "Summarize the student's overall past week and overall next week across all courses. " +
        "Ground everything in the provided data only. Prefer course-specific weeklyPulse data when available, then assignments, exams, and study blocks. " +
        "Return concise, practical, student-facing prose. " +
        "Return only strict JSON.",
      prompt:
        "Return one JSON object with exactly these top-level keys: " +
        '"pastWeekOverview", "nextWeekOverview", "courseHighlights", "confidence".\n\n' +
        "courseHighlights should contain up to 4 notable course-specific items across the semester. " +
        "Each item must include courseId, label, and reason.\n\n" +
        "Required JSON shape example:\n" +
        JSON.stringify(
          {
            pastWeekOverview: "You mostly worked across two heavy courses and kept up with planned study time.",
            nextWeekOverview: "The next week is deadline-heavy, with one exam and two near-term assignments.",
            courseHighlights: [
              {
                courseId: "course-1",
                label: "Algorithms needs attention",
                reason: "Quiz and homework are both due soon.",
              },
            ],
            confidence: 0.7,
          },
          null,
          2
        ) +
        "\n\nCurrent dashboard context:\n" +
        JSON.stringify({
          anchorDate,
          ...body,
        }),
    });

    return NextResponse.json({
      ok: true,
      overview: {
        ...result.object,
        anchorDate,
        generatedAt: new Date().toISOString(),
        model: aiConfig.model,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues.map((issue) => issue.message).join("; ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to generate dashboard overview." },
      { status: 500 }
    );
  }
}
