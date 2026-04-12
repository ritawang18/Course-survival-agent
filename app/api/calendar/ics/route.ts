import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserFromRequest } from "@/lib/supabase/server";
import { buildIcsCalendar } from "@/lib/calendar/ics";

export const runtime = "nodejs";

const CalendarEventSchema = z.object({
  summary: z.string().min(1),
  description: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  colorId: z.string().optional(),
  allDay: z.boolean().optional(),
  timeZone: z.string().optional(),
});

const RequestSchema = z.object({
  events: z.array(CalendarEventSchema),
  calendarName: z.string().optional(),
  fileName: z.string().optional(),
});

function sanitizeFileName(input?: string) {
  const base = (input?.trim() || "course-survival-agent-calendar.ics")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");

  return base.endsWith(".ics") ? base : `${base}.ics`;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request body" },
      { status: 400 }
    );
  }

  try {
    const ics = buildIcsCalendar({
      events: body.events,
      calendarName: body.calendarName ?? "Course Survival Agent",
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(body.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to build ICS file" },
      { status: 500 }
    );
  }
}
