import { createHash } from "crypto";
import type { CalendarExportEvent } from "@/lib/calendar/export-events";

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatUtcTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid calendar timestamp: ${value}`);
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatDateValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[1]}${match[2]}${match[3]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid all-day calendar date: ${value}`);
  }

  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function foldLine(line: string) {
  const limit = 75;
  if (line.length <= limit) return line;

  const parts: string[] = [];
  for (let i = 0; i < line.length; i += limit) {
    parts.push(i === 0 ? line.slice(i, i + limit) : ` ${line.slice(i, i + limit)}`);
  }
  return parts.join("\r\n");
}

function buildUid(event: CalendarExportEvent) {
  const hash = createHash("sha1")
    .update(`${event.summary}|${event.start}|${event.end}`)
    .digest("hex");
  return `${hash}@course-survival-agent`;
}

export function buildIcsCalendar(input: {
  events: CalendarExportEvent[];
  calendarName?: string;
  prodId?: string;
}) {
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${input.prodId ?? "-//Course Survival Agent//Calendar Export//EN"}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.calendarName ?? "Course Survival Agent")}`,
  ];

  for (const event of input.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${buildUid(event)}`);
    lines.push(`DTSTAMP:${now}`);

    if (event.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDateValue(event.start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateValue(event.end)}`);
    } else {
      lines.push(`DTSTART:${formatUtcTimestamp(event.start)}`);
      lines.push(`DTEND:${formatUtcTimestamp(event.end)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
