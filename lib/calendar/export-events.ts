import type { AppData, Assignment, Exam, StudyBlock } from "@/lib/store/types";

export interface CalendarExportEvent {
  summary: string;
  description?: string;
  start: string;
  end: string;
  colorId?: string;
  allDay?: boolean;
  timeZone?: string;
}

export interface CalendarDisplayEvent {
  id: string;
  courseId: string;
  title: string;
  date: string;
  start: string;
  end: string;
  type: StudyBlock["type"];
  allDay?: boolean;
  conflict?: boolean;
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

function formatCourseLabel(data: AppData, courseId: string) {
  const course = data.courses.find((c) => c.id === courseId);
  return course?.code ?? course?.course_id ?? "Course";
}

function examIdentityKey(exam: Exam) {
  return `${exam.course_id}|${normalizeText(exam.title)}|${(exam.date ?? "").slice(0, 16)}`;
}

function assignmentIdentityKey(assignment: Assignment) {
  return `${assignment.course_id}|${normalizeText(assignment.title)}|${(assignment.due_at ?? "").slice(0, 16)}`;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isExamLikeAssignment(assignment: Assignment) {
  return /exam|midterm|final/i.test(assignment.assignment_type) || /exam|midterm|final/i.test(assignment.title);
}

function looksAllDay(iso: string) {
  const parsed = new Date(iso);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCHours() === 0 &&
    parsed.getUTCMinutes() === 0 &&
    parsed.getUTCSeconds() === 0
  );
}

function toLocalTimeLabel(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(11, 16) || iso;
  return `${parsed.getHours().toString().padStart(2, "0")}:${parsed.getMinutes().toString().padStart(2, "0")}`;
}

function buildDeadlineDescription(assignment: Assignment) {
  return [
    `Type: ${assignment.assignment_type}`,
    assignment.points_possible != null ? `Points: ${assignment.points_possible}` : null,
    assignment.estimated_hours != null ? `Estimated hours: ${assignment.estimated_hours}` : null,
    assignment.description ? assignment.description : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildStudyBlockCalendarEvents(data: AppData): CalendarExportEvent[] {
  const now = Date.now();

  return data.studyBlocks
    .filter((block) => {
      const startMs = new Date(`${block.date}T${block.start}:00`).getTime();
      return Number.isFinite(startMs) && startMs >= now;
    })
    .map((block) => {
      const courseLabel = formatCourseLabel(data, block.course_id);
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
      const courseLabel = formatCourseLabel(data, exam.course_id);
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

export function buildDeadlineCalendarEvents(data: AppData): CalendarExportEvent[] {
  const now = Date.now();
  const knownExamKeys = new Set(data.exams.map(examIdentityKey));

  return data.assignments
    .filter((assignment) => !!assignment.due_at)
    .filter((assignment) => {
      const dueMs = new Date(assignment.due_at!).getTime();
      return Number.isFinite(dueMs) && dueMs >= now;
    })
    .filter((assignment) => !isExamLikeAssignment(assignment) || !knownExamKeys.has(assignmentIdentityKey(assignment)))
    .map((assignment) => {
      const courseLabel = formatCourseLabel(data, assignment.course_id);
      const parsed = new Date(assignment.due_at!);
      const isAllDay = looksAllDay(assignment.due_at!);

      return {
        summary: `${courseLabel} · ${assignment.title}`,
        description: buildDeadlineDescription(assignment),
        start: isAllDay ? parsed.toISOString().slice(0, 10) : parsed.toISOString(),
        end: isAllDay
          ? nextIsoDay(parsed.toISOString())
          : new Date(parsed.getTime() + 60 * 60 * 1000).toISOString(),
        colorId: GOOGLE_COLOR_BY_BLOCK_TYPE.deadline ?? "5",
        allDay: isAllDay,
      };
    });
}

export function buildCalendarDisplayEvents(data: AppData): CalendarDisplayEvent[] {
  const examKeys = new Set(data.exams.map(examIdentityKey));

  const studyEvents = data.studyBlocks.map((block) => ({
    id: `study:${block.id}`,
    courseId: block.course_id,
    title: block.title,
    date: block.date.slice(0, 10),
    start: block.start.slice(0, 5),
    end: block.end.slice(0, 5),
    type: block.type,
    conflict: block.conflict,
    allDay: false,
  }));

  const examEvents = data.exams.map((exam) => {
    const parsed = new Date(exam.date);
    const allDay = looksAllDay(exam.date);
    return {
      id: `exam:${exam.id}`,
      courseId: exam.course_id,
      title: exam.title,
      date: exam.date.slice(0, 10),
      start: allDay ? "All day" : toLocalTimeLabel(exam.date),
      end: allDay ? "All day" : toLocalTimeLabel(new Date(parsed.getTime() + 2 * 60 * 60 * 1000).toISOString()),
      type: "exam" as const,
      conflict: false,
      allDay,
    };
  });

  const deadlineEvents = data.assignments
    .filter((assignment) => !!assignment.due_at)
    .filter((assignment) => !isExamLikeAssignment(assignment) || !examKeys.has(assignmentIdentityKey(assignment)))
    .map((assignment) => {
      const parsed = new Date(assignment.due_at!);
      const allDay = looksAllDay(assignment.due_at!);
      return {
        id: `deadline:${assignment.id}`,
        courseId: assignment.course_id,
        title: assignment.title,
        date: assignment.due_at!.slice(0, 10),
        start: allDay ? "All day" : toLocalTimeLabel(assignment.due_at!),
        end: allDay ? "All day" : toLocalTimeLabel(new Date(parsed.getTime() + 60 * 60 * 1000).toISOString()),
        type: "deadline" as const,
        conflict: false,
        allDay,
      };
    });

  return [...studyEvents, ...examEvents, ...deadlineEvents].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.start.localeCompare(b.start);
  });
}

export function buildCalendarExportEvents(data: AppData): CalendarExportEvent[] {
  return [
    ...buildStudyBlockCalendarEvents(data),
    ...buildDeadlineCalendarEvents(data),
    ...buildExamCalendarEvents(data),
  ];
}
