import type { AppData, StudyBlock } from "@/lib/store/types";

export interface CalendarExportEvent {
  summary: string;
  description?: string;
  start: string;
  end: string;
  colorId?: string;
  allDay?: boolean;
  timeZone?: string;
}

const GOOGLE_COLOR_BY_BLOCK_TYPE: Partial<Record<StudyBlock["type"], string>> = {
  study: "9",
  exam: "11",
  office_hours: "10",
  deadline: "5",
};

export function nextIsoDay(iso: string) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function toTimedIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function buildStudyBlockCalendarEvents(data: AppData): CalendarExportEvent[] {
  const now = Date.now();

  return data.studyBlocks
    .filter((block) => {
      const startMs = new Date(`${block.date}T${block.start}:00`).getTime();
      return Number.isFinite(startMs) && startMs >= now;
    })
    .map((block) => {
      const course = data.courses.find((c) => c.id === block.course_id);
      const courseLabel = course?.code ?? course?.course_id ?? "Course";
      return {
        summary: `${courseLabel} · ${block.title}`,
        description: [
          `Type: ${block.type}`,
          block.priority ? `Priority: ${block.priority}` : null,
          block.difficulty ? `Difficulty: ${block.difficulty}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        start: toTimedIso(block.date, block.start),
        end: toTimedIso(block.date, block.end),
        colorId: GOOGLE_COLOR_BY_BLOCK_TYPE[block.type] ?? "9",
      };
    });
}

export function buildExamCalendarEvents(data: AppData): CalendarExportEvent[] {
  const now = Date.now();

  return data.exams
    .filter((exam) => {
      const examMs = new Date(exam.date).getTime();
      return Number.isFinite(examMs) && examMs >= now;
    })
    .map((exam) => {
      const course = data.courses.find((c) => c.id === exam.course_id);
      const courseLabel = course?.code ?? course?.course_id ?? "Course";
      const parsed = new Date(exam.date);
      const isAllDay =
        parsed.getUTCHours() === 0 &&
        parsed.getUTCMinutes() === 0 &&
        parsed.getUTCSeconds() === 0;

      return {
        summary: `${courseLabel} · ${exam.title}`,
        description: exam.location
          ? `Exam\nLocation: ${exam.location}\nWeight: ${exam.weight}%`
          : `Exam\nWeight: ${exam.weight}%`,
        start: isAllDay ? parsed.toISOString().slice(0, 10) : parsed.toISOString(),
        end: isAllDay
          ? nextIsoDay(parsed.toISOString())
          : new Date(parsed.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        colorId: "11",
        allDay: isAllDay,
      };
    });
}

export function buildCalendarExportEvents(data: AppData): CalendarExportEvent[] {
  return [
    ...buildStudyBlockCalendarEvents(data),
    ...buildExamCalendarEvents(data),
  ];
}
