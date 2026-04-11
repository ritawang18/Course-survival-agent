import { NextRequest, NextResponse } from "next/server";
import { createEvent } from "@/lib/google-calendar";
import { getCalendarClient } from "@/lib/calendar-auth";
import type { SyllabusParseResult } from "@/lib/parsers/syllabus";

export const runtime = "nodejs";

// Google Calendar color IDs
const COLOR_EXAM = "11";      // red
const COLOR_QUIZ = "5";       // yellow
const COLOR_PROJECT = "2";    // green
const COLOR_DEADLINE = "9";   // blue

/**
 * POST /api/calendar/sync-syllabus
 *
 * Body: {
 *   syllabus: SyllabusParseResult   (the parsed output from /api/upload)
 *   courseName?: string             (override if user renamed the course)
 *   timeZone?: string               (IANA timezone, e.g. "America/New_York". Defaults to UTC)
 * }
 *
 * Creates one Google Calendar event per exam date and deadline.
 * Returns the list of created event IDs.
 */
export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await getCalendarClient();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { client } = auth;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { syllabus: SyllabusParseResult; courseName?: string; timeZone?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { syllabus, courseName: courseNameOverride, timeZone = "UTC" } = body;
  if (!syllabus) {
    return NextResponse.json({ error: "syllabus field is required" }, { status: 400 });
  }

  // Prefer explicit override, then parsed name, then parsed code, then fallback
  const courseName =
    courseNameOverride ??
    syllabus.courseName ??
    syllabus.courseCode ??
    "Course";

  // ── Build events list ─────────────────────────────────────────────────────
  type EventSpec = {
    summary: string;
    description: string;
    start: string;
    end: string;
    colorId: string;
    allDay: boolean;
    timeZone: string;
  };

  const eventsToCreate: EventSpec[] = [];

  // Exam dates → all-day if no specific time, else 2-hour block; red
  for (const exam of syllabus.examDates) {
    if (exam.confidence < 0.7) continue;
    const allDay = hasNoTime(exam.date);
    const start = exam.date;
    // All-day end = next calendar day (Google Calendar convention)
    const end = allDay ? nextDay(exam.date) : addHours(exam.date, 2);
    eventsToCreate.push({
      summary: `${courseName} – ${exam.label}`,
      description: `Exam | Confidence: ${Math.round(exam.confidence * 100)}%`,
      start,
      end,
      colorId: COLOR_EXAM,
      allDay,
      timeZone,
    });
  }

  // Deadlines → 1-hour block at due time; color by type
  for (const deadline of syllabus.deadlines) {
    if (deadline.confidence < 0.7) continue;
    const allDay = hasNoTime(deadline.date);
    const start = deadline.date;
    const end = allDay ? nextDay(deadline.date) : addHours(deadline.date, 1);
    const colorId = classifyDeadline(deadline.label);
    eventsToCreate.push({
      summary: `${courseName} – ${deadline.label}`,
      description: `Deadline | Confidence: ${Math.round(deadline.confidence * 100)}%`,
      start,
      end,
      colorId,
      allDay,
      timeZone,
    });
  }

  if (eventsToCreate.length === 0) {
    return NextResponse.json({
      created: [],
      skipped: syllabus.examDates.length + syllabus.deadlines.length,
      message: "No events met the confidence threshold (0.7). Check parsed syllabus data.",
    });
  }

  // ── Create events (sequential to avoid rate limits) ───────────────────────
  const created: { eventId: string; summary: string }[] = [];
  const failed: { summary: string; error: string }[] = [];

  for (const ev of eventsToCreate) {
    try {
      const eventId = await createEvent(client, ev);
      created.push({ eventId, summary: ev.summary });
    } catch (err) {
      console.error("[sync-syllabus] Failed to create event:", ev.summary, err);
      failed.push({ summary: ev.summary, error: String(err) });
    }
  }

  return NextResponse.json({
    created,
    failed,
    total: eventsToCreate.length,
    message: `Created ${created.length} of ${eventsToCreate.length} events.`,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the parser left the time as 00:00:00, meaning no specific time was found. */
function hasNoTime(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

/** Add N hours to an ISO datetime string. */
function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/** Return the next calendar day as YYYY-MM-DD (required by Google for all-day event end). */
function nextDay(iso: string): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Pick a color based on the deadline label. */
function classifyDeadline(label: string): string {
  if (/quiz/i.test(label))                        return COLOR_QUIZ;
  if (/project|final project/i.test(label))       return COLOR_PROJECT;
  return COLOR_DEADLINE;
}
