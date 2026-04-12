import { addDays, endOfDay, formatISO, startOfDay, subDays } from "date-fns";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { getServiceClient } from "@/lib/supabase/server";
import {
  WeeklyCoursePulseGenerationSchema,
  type WeeklyCoursePulseRecord,
  type WeeklyCoursePulseSourceSummary,
} from "@/lib/schemas/weekly-course-pulse";

const MODEL_NAME = "claude-sonnet-4-5";

interface DbCourseRow {
  id: string;
  course_id: string;
  course_name: string | null;
  instructor_name: string | null;
  attendance_allowed_misses: number | null;
  updated_at: string | null;
}

interface DbSyllabusRow {
  course_id: string;
  break_down: unknown;
  exam_dates: unknown;
  project_date: unknown;
  cut_off: unknown;
}

interface DbStudyPlanRow {
  id: string;
  course_id: string;
  title: string | null;
  type: string | null;
  priority: string | null;
  difficulty: string | null;
}

interface DbCourseGradeRow {
  id: string;
  current_percent: number | null;
  current_letter_grade: string | null;
  projected_percent: number | null;
  projected_letter_grade: string | null;
}

interface DbAssignmentRow {
  id: string;
  course_id: string;
  canvas_assignment_id: string | null;
  title: string;
  assignment_type: string | null;
  description: string | null;
  due_at: string | null;
  available_from: string | null;
  available_until: string | null;
  points_possible: number | null;
  status: string | null;
  estimated_hours: number | null;
  dependencies: string[] | null;
}

interface CanvasAssignmentSummary {
  id: number | string;
  name: string;
  due_at?: string | null;
  unlock_at?: string | null;
  points_possible?: number | null;
  submission_types?: string[] | null;
  has_submitted_submissions?: boolean;
  published?: boolean;
}

interface CanvasModuleSummary {
  id: number | string;
  name: string;
  position?: number | null;
  unlock_at?: string | null;
  state?: string | null;
  published?: boolean;
  items?: Array<{
    id?: number | string;
    title?: string | null;
    type?: string | null;
    position?: number | null;
    completion_requirement?: {
      type?: string | null;
      completed?: boolean | null;
    } | null;
  }>;
}

interface WeeklyCoursePulseContext {
  course: DbCourseRow;
  syllabus: DbSyllabusRow | null;
  currentGrade: DbCourseGradeRow | null;
  studyPlan: DbStudyPlanRow | null;
  assignmentsPastWeek: DbAssignmentRow[];
  assignmentsNextWeek: DbAssignmentRow[];
  canvasAssignmentsPastWeek: CanvasAssignmentSummary[];
  canvasAssignmentsNextWeek: CanvasAssignmentSummary[];
  canvasModules: CanvasModuleSummary[];
}

export interface GenerateWeeklyCoursePulseInput {
  courseUuid: string;
  canvasCourseId?: string;
  canvasBaseUrl?: string;
  canvasAccessToken?: string;
  referenceDate?: string | Date;
}

export interface GenerateWeeklyCoursePulseResult extends WeeklyCoursePulseRecord {
  sourceSummary: WeeklyCoursePulseSourceSummary;
}

function toIsoDay(date: Date): string {
  return formatISO(date, { representation: "date" });
}

function toIsoTimestamp(date: Date): string {
  return formatISO(date);
}

function isWithinWindow(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed >= start && parsed <= end;
}

async function fetchCanvasJson<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Canvas API request failed: ${res.status}`);
  }

  return (await res.json()) as T;
}

async function fetchCanvasAssignments(
  canvasBaseUrl: string,
  canvasCourseId: string,
  token: string
): Promise<CanvasAssignmentSummary[]> {
  const url = `${canvasBaseUrl.replace(/\/$/, "")}/api/v1/courses/${canvasCourseId}/assignments?per_page=100`;
  const data = await fetchCanvasJson<CanvasAssignmentSummary[]>(url, token);
  return Array.isArray(data) ? data : [];
}

async function fetchCanvasModules(
  canvasBaseUrl: string,
  canvasCourseId: string,
  token: string
): Promise<CanvasModuleSummary[]> {
  const url =
    `${canvasBaseUrl.replace(/\/$/, "")}/api/v1/courses/${canvasCourseId}` +
    "/modules?include[]=items&per_page=50";
  const data = await fetchCanvasJson<CanvasModuleSummary[]>(url, token);
  return Array.isArray(data) ? data : [];
}

async function gatherContext(
  input: GenerateWeeklyCoursePulseInput
): Promise<{
  context: WeeklyCoursePulseContext;
  sourceSummary: WeeklyCoursePulseSourceSummary;
  anchorDate: string;
  pastWindowStart: string;
  pastWindowEnd: string;
  futureWindowStart: string;
  futureWindowEnd: string;
}> {
  const supabase = getServiceClient();
  const anchor = input.referenceDate ? new Date(input.referenceDate) : new Date();
  if (Number.isNaN(anchor.getTime())) {
    throw new Error("Invalid referenceDate");
  }

  const anchorDate = toIsoDay(anchor);
  const pastStart = startOfDay(subDays(anchor, 7));
  const pastEnd = endOfDay(anchor);
  const futureStart = startOfDay(anchor);
  const futureEnd = endOfDay(addDays(anchor, 7));

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, course_id, course_name, instructor_name, attendance_allowed_misses, updated_at")
    .eq("id", input.courseUuid)
    .maybeSingle();

  if (courseError) {
    throw new Error(`Weekly pulse course lookup failed: ${courseError.message}`);
  }
  if (!course) {
    throw new Error(`Course not found for uuid ${input.courseUuid}`);
  }

  const [syllabusResult, gradeResult, studyPlanResult, assignmentsResult] = await Promise.all([
    supabase
      .from("syllabus")
      .select("course_id, break_down, exam_dates, project_date, cut_off")
      .eq("course_id", (course as DbCourseRow).course_id)
      .maybeSingle(),
    supabase
      .from("course_grades")
      .select("id, current_percent, current_letter_grade, projected_percent, projected_letter_grade")
      .eq("id", input.courseUuid)
      .maybeSingle(),
    supabase
      .from("study_plan")
      .select("id, course_id, title, type, priority, difficulty")
      .eq("id", input.courseUuid)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select(
        "id, course_id, canvas_assignment_id, title, assignment_type, description, due_at, available_from, available_until, points_possible, status, estimated_hours, dependencies"
      )
      .eq("course_id", input.courseUuid)
      .order("due_at", { ascending: true }),
  ]);

  if (syllabusResult.error) {
    throw new Error(`Weekly pulse syllabus lookup failed: ${syllabusResult.error.message}`);
  }
  if (gradeResult.error) {
    throw new Error(`Weekly pulse grade lookup failed: ${gradeResult.error.message}`);
  }
  if (studyPlanResult.error) {
    throw new Error(`Weekly pulse study plan lookup failed: ${studyPlanResult.error.message}`);
  }
  if (assignmentsResult.error) {
    throw new Error(`Weekly pulse assignments lookup failed: ${assignmentsResult.error.message}`);
  }

  const dbAssignments = (assignmentsResult.data ?? []) as DbAssignmentRow[];
  const assignmentsPastWeek = dbAssignments.filter((item) => isWithinWindow(item.due_at, pastStart, pastEnd));
  const assignmentsNextWeek = dbAssignments.filter((item) => isWithinWindow(item.due_at, futureStart, futureEnd));

  let canvasAssignmentsPastWeek: CanvasAssignmentSummary[] = [];
  let canvasAssignmentsNextWeek: CanvasAssignmentSummary[] = [];
  let canvasModules: CanvasModuleSummary[] = [];

  if (input.canvasBaseUrl && input.canvasAccessToken && input.canvasCourseId) {
    try {
      const [canvasAssignments, modules] = await Promise.all([
        fetchCanvasAssignments(input.canvasBaseUrl, input.canvasCourseId, input.canvasAccessToken),
        fetchCanvasModules(input.canvasBaseUrl, input.canvasCourseId, input.canvasAccessToken),
      ]);

      canvasAssignmentsPastWeek = canvasAssignments.filter((item) =>
        isWithinWindow(item.due_at ?? item.unlock_at, pastStart, pastEnd)
      );
      canvasAssignmentsNextWeek = canvasAssignments.filter((item) =>
        isWithinWindow(item.due_at ?? item.unlock_at, futureStart, futureEnd)
      );
      canvasModules = modules;
    } catch (err) {
      console.error("[weekly-course-pulse] Canvas enrichment failed", err);
    }
  }

  const context: WeeklyCoursePulseContext = {
    course: course as DbCourseRow,
    syllabus: (syllabusResult.data as DbSyllabusRow | null) ?? null,
    currentGrade: (gradeResult.data as DbCourseGradeRow | null) ?? null,
    studyPlan: (studyPlanResult.data as DbStudyPlanRow | null) ?? null,
    assignmentsPastWeek,
    assignmentsNextWeek,
    canvasAssignmentsPastWeek,
    canvasAssignmentsNextWeek,
    canvasModules,
  };

  return {
    context,
    sourceSummary: {
      hasDatabaseContext:
        !!context.syllabus ||
        !!context.studyPlan ||
        !!context.currentGrade ||
        context.assignmentsPastWeek.length > 0 ||
        context.assignmentsNextWeek.length > 0,
      hasCanvasApiContext:
        context.canvasAssignmentsPastWeek.length > 0 ||
        context.canvasAssignmentsNextWeek.length > 0 ||
        context.canvasModules.length > 0,
    },
    anchorDate,
    pastWindowStart: toIsoDay(pastStart),
    pastWindowEnd: toIsoDay(pastEnd),
    futureWindowStart: toIsoDay(futureStart),
    futureWindowEnd: toIsoDay(futureEnd),
  };
}

export async function generateWeeklyCoursePulse(
  input: GenerateWeeklyCoursePulseInput
): Promise<GenerateWeeklyCoursePulseResult> {
  const gathered = await gatherContext(input);
  const generatedAt = toIsoTimestamp(new Date());

  const result = await generateObject({
    model: anthropic(MODEL_NAME),
    schema: WeeklyCoursePulseGenerationSchema,
    system:
      "You generate a weekly course pulse for a student support system. " +
      "You must ground everything in the provided evidence only. " +
      "Priority when sources disagree: database > canvas_api > inferred. " +
      "pastWeekLearned should explain what the student most likely covered or completed in the last 7 days. " +
      "nextWeekPreview should explain what the student is likely to face in the next 7 days. " +
      "Use uncertainty language when evidence is sparse. Never invent deadlines, policies, or topics. " +
      "Return concise but specific prose. Each evidence list should contain 2-6 grounded items when possible, fewer if the evidence is weak. " +
      "Confidence should be low when the input is sparse and higher only when multiple concrete signals align.",
    prompt: JSON.stringify({
      anchorDate: gathered.anchorDate,
      pastWindowStart: gathered.pastWindowStart,
      pastWindowEnd: gathered.pastWindowEnd,
      futureWindowStart: gathered.futureWindowStart,
      futureWindowEnd: gathered.futureWindowEnd,
      context: gathered.context,
    }),
  });

  return {
    courseUuid: gathered.context.course.id,
    courseId: gathered.context.course.course_id,
    courseName: gathered.context.course.course_name,
    anchorDate: gathered.anchorDate,
    pastWindowStart: gathered.pastWindowStart,
    pastWindowEnd: gathered.pastWindowEnd,
    futureWindowStart: gathered.futureWindowStart,
    futureWindowEnd: gathered.futureWindowEnd,
    generatedAt,
    model: MODEL_NAME,
    sourceSummary: gathered.sourceSummary,
    pulse: result.object,
    rawContext: gathered.context,
  };
}
