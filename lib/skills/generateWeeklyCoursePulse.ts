import { addDays, endOfDay, formatISO, startOfDay, subDays } from "date-fns";
import { getServiceClient } from "@/lib/supabase/server";
import { getCourseCanvasSettings } from "@/lib/db/course_canvas_settings";
import { generateObjectWithAI, type AIConfig } from "@/lib/ai/client";
import {
  WeeklyCoursePulseGenerationSchema,
  type WeeklyCoursePulseRecord,
  type WeeklyCoursePulseSourceSummary,
} from "@/lib/schemas/weekly-course-pulse";

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
  topic_outline: unknown;
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

interface TopicSignal {
  label: string;
  detail: string;
  source: "database" | "canvas_api" | "syllabus" | "planner" | "inferred";
}

interface NormalizedSyllabusTopicOutlineRow {
  label: string;
  topics: string[];
  confidence: number;
  order: number;
  weekNumber: number | null;
  rangeStart: Date | null;
  rangeEnd: Date | null;
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
  pastTopicSignals: TopicSignal[];
  nextTopicSignals: TopicSignal[];
}

export interface GenerateWeeklyCoursePulseInput {
  courseUuid: string;
  canvasCourseId?: string;
  canvasBaseUrl?: string;
  canvasAccessToken?: string;
  referenceDate?: string | Date;
  aiConfig?: AIConfig;
}

export interface GenerateWeeklyCoursePulseResult extends WeeklyCoursePulseRecord {
  sourceSummary: WeeklyCoursePulseSourceSummary;
}

export class WeeklyCoursePulseError extends Error {
  constructor(
    public reason:
      | "course_not_found"
      | "database_lookup_failed"
      | "canvas_enrichment_unavailable"
      | "llm_generation_failed"
      | "invalid_reference_date",
    message: string
  ) {
    super(message);
    this.name = "WeeklyCoursePulseError";
  }
}

function toIsoDay(date: Date): string {
  return formatISO(date, { representation: "date" });
}

function toIsoTimestamp(date: Date): string {
  return formatISO(date);
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripLeadingModuleMarker(value: string) {
  return value
    .replace(/^(module|week|unit|chapter|lecture)\s*\d+\s*[:\-]\s*/i, "")
    .replace(/^(module|week|unit|chapter|lecture)\s*\d+\s+/i, "")
    .trim();
}

function normalizeTopicText(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = compactWhitespace(stripLeadingModuleMarker(value));
  if (!cleaned) return null;
  if (/^(module|week|unit|chapter|lecture)\b/i.test(cleaned) && cleaned.split(" ").length <= 3) {
    return null;
  }
  if (/^(home|dashboard|overview|assignments?|pages?|discussion|quiz|exam|file)s?$/i.test(cleaned)) {
    return null;
  }
  return cleaned;
}

function dedupeTopicSignals(signals: TopicSignal[], limit = 6): TopicSignal[] {
  const seen = new Set<string>();
  const result: TopicSignal[] = [];

  for (const signal of signals) {
    const key = `${signal.label.toLowerCase()}::${signal.detail.toLowerCase()}::${signal.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(signal);
    if (result.length >= limit) break;
  }

  return result;
}

function getModuleTopicCandidates(module: CanvasModuleSummary): string[] {
  const values: string[] = [];
  const moduleName = normalizeTopicText(module.name);
  if (moduleName) {
    values.push(moduleName);
  }

  for (const item of module.items ?? []) {
    const title = normalizeTopicText(item.title);
    if (!title) continue;
    if (/^(submit|discussion|quiz|assignment)\b/i.test(title)) continue;
    values.push(title);
  }

  return Array.from(new Set(values));
}

function buildModuleTopicDetail(module: CanvasModuleSummary) {
  const topics = getModuleTopicCandidates(module);
  if (topics.length === 0) {
    return null;
  }

  if (topics.length === 1) {
    return topics[0];
  }

  return topics.slice(0, 3).join("; ");
}

function buildCanvasModuleTopicSignals(
  modules: CanvasModuleSummary[],
  pastStart: Date,
  pastEnd: Date,
  futureStart: Date,
  futureEnd: Date
): { pastTopicSignals: TopicSignal[]; nextTopicSignals: TopicSignal[] } {
  const sorted = [...modules].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const pastSignals: TopicSignal[] = [];
  const nextSignals: TopicSignal[] = [];

  for (const module of sorted) {
    const detail = buildModuleTopicDetail(module);
    if (!detail) continue;

    const label = normalizeTopicText(module.name) ?? "Canvas module";
    const unlockAt = module.unlock_at ? new Date(module.unlock_at) : null;
    const isPastByDate =
      unlockAt && !Number.isNaN(unlockAt.getTime()) && unlockAt >= pastStart && unlockAt <= pastEnd;
    const isFutureByDate =
      unlockAt && !Number.isNaN(unlockAt.getTime()) && unlockAt >= futureStart && unlockAt <= futureEnd;

    if (isPastByDate) {
      pastSignals.push({ label, detail, source: "canvas_api" });
      continue;
    }

    if (isFutureByDate) {
      nextSignals.push({ label, detail, source: "canvas_api" });
    }
  }

  if (pastSignals.length > 0 || nextSignals.length > 0) {
    return {
      pastTopicSignals: dedupeTopicSignals(pastSignals),
      nextTopicSignals: dedupeTopicSignals(nextSignals),
    };
  }

  const pivot =
    sorted.findIndex((module) => module.state !== "completed") === -1
      ? Math.max(0, sorted.length - 1)
      : sorted.findIndex((module) => module.state !== "completed");

  const fallbackPast = sorted
    .slice(Math.max(0, pivot - 2), pivot)
    .map<TopicSignal | null>((module) => {
      const detail = buildModuleTopicDetail(module);
      if (!detail) return null;
      return {
        label: normalizeTopicText(module.name) ?? "Recent module",
        detail,
        source: "canvas_api" as const,
      };
    })
    .filter((item): item is TopicSignal => item !== null);

  const fallbackNext = sorted
    .slice(pivot, pivot + 2)
    .map<TopicSignal | null>((module) => {
      const detail = buildModuleTopicDetail(module);
      if (!detail) return null;
      return {
        label: normalizeTopicText(module.name) ?? "Upcoming module",
        detail,
        source: "canvas_api" as const,
      };
    })
    .filter((item): item is TopicSignal => item !== null);

  return {
    pastTopicSignals: dedupeTopicSignals(fallbackPast),
    nextTopicSignals: dedupeTopicSignals(fallbackNext),
  };
}

function buildAssignmentTopicSignals(
  assignments: DbAssignmentRow[],
  source: "database" | "canvas_api" = "database"
): TopicSignal[] {
  const signals: TopicSignal[] = [];

  for (const assignment of assignments) {
    for (const dependency of assignment.dependencies ?? []) {
      const topic = normalizeTopicText(dependency);
      if (!topic) continue;
      signals.push({
        label: assignment.title,
        detail: `Concept focus: ${topic}`,
        source,
      });
    }
  }

  return dedupeTopicSignals(signals);
}

function asDatedOutlineItems(value: unknown): Array<{ label: string; date: string }> {
  return Array.isArray(value)
    ? value
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const label = typeof item.label === "string" ? item.label.trim() : "";
          const date = typeof item.date === "string" ? item.date.trim() : "";
          if (!label || !date) return null;
          return { label, date };
        })
        .filter((item): item is { label: string; date: string } => item !== null)
    : [];
}

function asTopicOutlineRows(
  value: unknown
): Array<{ label?: unknown; topics?: unknown; dateRange?: unknown; confidence?: unknown }> {
  return Array.isArray(value)
    ? value.filter((item): item is { label?: unknown; topics?: unknown; dateRange?: unknown; confidence?: unknown } =>
        !!item && typeof item === "object"
      )
    : [];
}

function extractWeekNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(?:week|wk)\s*(\d{1,2})\b/i);
  if (match) {
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function monthIndexFromName(value: string): number | null {
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const normalized = value.trim().slice(0, 3).toLowerCase();
  const index = months.indexOf(normalized);
  return index >= 0 ? index : null;
}

function normalizeYearNearAnchor(year: number, month: number, anchor: Date) {
  const candidate = new Date(year, month, 1);
  const anchorMonthDistance =
    (candidate.getFullYear() - anchor.getFullYear()) * 12 + (candidate.getMonth() - anchor.getMonth());

  if (anchorMonthDistance > 6) return year - 1;
  if (anchorMonthDistance < -6) return year + 1;
  return year;
}

function buildDateNearAnchor(anchor: Date, month: number, day: number, explicitYear?: number | null) {
  const baseYear = explicitYear ?? anchor.getFullYear();
  const adjustedYear = normalizeYearNearAnchor(baseYear, month, anchor);
  return new Date(adjustedYear, month, day);
}

function parseDateToken(token: string, anchor: Date): Date | null {
  const cleaned = token.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;

  const isoCandidate = new Date(cleaned);
  if (!Number.isNaN(isoCandidate.getTime())) {
    return isoCandidate;
  }

  const monthNameMatch = cleaned.match(
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/
  );
  if (monthNameMatch) {
    const month = monthIndexFromName(monthNameMatch[1]);
    const day = Number(monthNameMatch[2]);
    const explicitYear = monthNameMatch[3] ? Number(monthNameMatch[3]) : null;
    if (month != null && Number.isFinite(day)) {
      return buildDateNearAnchor(anchor, month, day, explicitYear);
    }
  }

  const numericMatch = cleaned.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericMatch) {
    const month = Number(numericMatch[1]) - 1;
    const day = Number(numericMatch[2]);
    const explicitYear = numericMatch[3]
      ? Number(numericMatch[3].length === 2 ? `20${numericMatch[3]}` : numericMatch[3])
      : null;
    if (month >= 0 && month <= 11 && Number.isFinite(day)) {
      return buildDateNearAnchor(anchor, month, day, explicitYear);
    }
  }

  return null;
}

function parseDateRange(value: string | null | undefined, anchor: Date): { start: Date; end: Date } | null {
  if (!value) return null;

  const cleaned = value.replace(/[–—]/g, "-").trim();
  if (!cleaned) return null;

  const parts = cleaned
    .split(/\s*-\s*|\s+to\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  const start = parseDateToken(parts[0], anchor);
  if (!start) return null;

  let end = start;
  if (parts.length > 1) {
    const parsedEnd = parseDateToken(parts[1], anchor);
    if (parsedEnd) {
      end = parsedEnd;
    } else {
      const trailingDay = parts[1].match(/^(\d{1,2})$/);
      if (trailingDay) {
        end = new Date(start.getFullYear(), start.getMonth(), Number(trailingDay[1]));
      }
    }
  }

  if (end < start) {
    end = new Date(end.getFullYear() + 1, end.getMonth(), end.getDate());
  }

  return { start, end };
}

function getCanvasModulePivot(modules: CanvasModuleSummary[]): number | null {
  if (modules.length === 0) return null;
  const sorted = [...modules].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstIncomplete = sorted.findIndex((module) => module.state !== "completed");
  if (firstIncomplete >= 0) return firstIncomplete;
  return Math.max(0, sorted.length - 1);
}

function scalePivotIndex(sourceLength: number, targetLength: number, pivot: number): number {
  if (sourceLength <= 1 || targetLength <= 1) return 0;
  const ratio = pivot / Math.max(1, sourceLength - 1);
  return Math.round(ratio * Math.max(1, targetLength - 1));
}

function estimateOutlinePivotFromAssignments(
  outlineLength: number,
  dbAssignments: DbAssignmentRow[],
  canvasAssignmentsPastWeek: CanvasAssignmentSummary[],
  canvasAssignmentsNextWeek: CanvasAssignmentSummary[],
  anchorDate: Date
): number | null {
  const dueDates = [
    ...dbAssignments.map((assignment) => assignment.due_at).filter((value): value is string => !!value),
    ...canvasAssignmentsPastWeek
      .map((assignment) => assignment.due_at ?? assignment.unlock_at)
      .filter((value): value is string => !!value),
    ...canvasAssignmentsNextWeek
      .map((assignment) => assignment.due_at ?? assignment.unlock_at)
      .filter((value): value is string => !!value),
  ]
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dueDates.length < 2) return null;

  const completedRatio =
    dueDates.filter((date) => date <= anchorDate).length / Math.max(1, dueDates.length);
  return Math.min(
    Math.max(Math.round(completedRatio * Math.max(0, outlineLength - 1)), 0),
    Math.max(0, outlineLength - 1)
  );
}

function buildSyllabusTopicSignals(
  topicOutline: unknown,
  options: {
    anchorDate: Date;
    pastStart: Date;
    pastEnd: Date;
    futureStart: Date;
    futureEnd: Date;
    canvasModules: CanvasModuleSummary[];
    dbAssignments: DbAssignmentRow[];
    canvasAssignmentsPastWeek: CanvasAssignmentSummary[];
    canvasAssignmentsNextWeek: CanvasAssignmentSummary[];
  }
): { pastTopicSignals: TopicSignal[]; nextTopicSignals: TopicSignal[] } {
  const rows = asTopicOutlineRows(topicOutline);
  if (rows.length === 0) {
    return { pastTopicSignals: [], nextTopicSignals: [] };
  }

  const normalized = rows
    .map<NormalizedSyllabusTopicOutlineRow | null>((row, index) => {
      const label = normalizeTopicText(typeof row.label === "string" ? row.label : null);
      const topics = Array.isArray(row.topics)
        ? row.topics
            .map((topic) => (typeof topic === "string" ? normalizeTopicText(topic) : null))
            .filter((topic): topic is string => !!topic)
        : [];
      const confidence =
        typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0.7;

      if (topics.length === 0) {
        return null;
      }

      const rawDateRange = typeof row.dateRange === "string" ? row.dateRange : null;
      const parsedRange = parseDateRange(rawDateRange, options.anchorDate);

      return {
        label: label ?? "Syllabus outline",
        topics,
        confidence,
        order: index,
        weekNumber: extractWeekNumber(label ?? rawDateRange ?? ""),
        rangeStart: parsedRange?.start ?? null,
        rangeEnd: parsedRange?.end ?? null,
      };
    })
    .filter((row): row is NormalizedSyllabusTopicOutlineRow => row !== null);

  if (normalized.length === 0) {
    return { pastTopicSignals: [], nextTopicSignals: [] };
  }

  const dateAwarePast = normalized.filter(
    (row) => row.rangeStart && row.rangeEnd && row.rangeEnd >= options.pastStart && row.rangeStart <= options.pastEnd
  );
  const dateAwareNext = normalized.filter(
    (row) =>
      row.rangeStart && row.rangeEnd && row.rangeEnd >= options.futureStart && row.rangeStart <= options.futureEnd
  );

  if (dateAwarePast.length > 0 || dateAwareNext.length > 0) {
    return {
      pastTopicSignals: dedupeTopicSignals(
        dateAwarePast.map((row) => ({
          label: row.label,
          detail: row.topics.slice(0, 3).join("; "),
          source: "syllabus" as const,
        }))
      ),
      nextTopicSignals: dedupeTopicSignals(
        dateAwareNext.map((row) => ({
          label: row.label,
          detail: row.topics.slice(0, 3).join("; "),
          source: "syllabus" as const,
        }))
      ),
    };
  }

  const weekNumberRows = normalized.filter((row) => row.weekNumber != null);
  if (weekNumberRows.length >= 2) {
    const canvasPivot = getCanvasModulePivot(options.canvasModules);
    const moduleScaledPivot =
      canvasPivot != null
        ? scalePivotIndex(options.canvasModules.length, normalized.length, canvasPivot)
        : null;
    const assignmentPivot = estimateOutlinePivotFromAssignments(
      normalized.length,
      options.dbAssignments,
      options.canvasAssignmentsPastWeek,
      options.canvasAssignmentsNextWeek,
      options.anchorDate
    );
    const inferredPivot =
      moduleScaledPivot ?? assignmentPivot ?? Math.floor((normalized.length - 1) / 2);

    const activeWeekNumber = normalized[inferredPivot]?.weekNumber ?? weekNumberRows[0].weekNumber ?? 1;
    const pastRows = weekNumberRows.filter(
      (row) => row.weekNumber != null && row.weekNumber >= activeWeekNumber - 1 && row.weekNumber <= activeWeekNumber
    );
    const nextRows = weekNumberRows.filter(
      (row) => row.weekNumber != null && row.weekNumber >= activeWeekNumber && row.weekNumber <= activeWeekNumber + 1
    );

    if (pastRows.length > 0 || nextRows.length > 0) {
      return {
        pastTopicSignals: dedupeTopicSignals(
          pastRows.map((row) => ({
            label: row.label,
            detail: row.topics.slice(0, 3).join("; "),
            source: "syllabus" as const,
          }))
        ),
        nextTopicSignals: dedupeTopicSignals(
          nextRows.map((row) => ({
            label: row.label,
            detail: row.topics.slice(0, 3).join("; "),
            source: "syllabus" as const,
          }))
        ),
      };
    }
  }

  const canvasPivot = getCanvasModulePivot(options.canvasModules);
  const assignmentPivot = estimateOutlinePivotFromAssignments(
    normalized.length,
    options.dbAssignments,
    options.canvasAssignmentsPastWeek,
    options.canvasAssignmentsNextWeek,
    options.anchorDate
  );
  const orderPivot =
    canvasPivot != null
      ? scalePivotIndex(options.canvasModules.length, normalized.length, canvasPivot)
      : assignmentPivot ?? Math.floor((normalized.length - 1) / 2);
  const pastRows = normalized.slice(Math.max(0, orderPivot - 1), orderPivot + 1);
  const nextRows = normalized.slice(orderPivot, Math.min(normalized.length, orderPivot + 2));

  return {
    pastTopicSignals: dedupeTopicSignals(
      pastRows.map((row) => ({
        label: row.label,
        detail: row.topics.slice(0, 3).join("; "),
        source: "syllabus" as const,
      }))
    ),
    nextTopicSignals: dedupeTopicSignals(
      nextRows.map((row) => ({
        label: row.label,
        detail: row.topics.slice(0, 3).join("; "),
        source: "syllabus" as const,
      }))
    ),
  };
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
    throw new WeeklyCoursePulseError("invalid_reference_date", "Invalid referenceDate");
  }
  const anchorPoint = toMostRecentFriday(anchor);
  const anchorDate = toIsoDay(anchorPoint);
  const pastStart = startOfDay(subDays(anchorPoint, 7));
  const pastEnd = endOfDay(anchorPoint);
  const futureStart = startOfDay(anchorPoint);
  const futureEnd = endOfDay(addDays(anchorPoint, 7));

  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, course_id, course_name, instructor_name, attendance_allowed_misses, updated_at")
    .eq("id", input.courseUuid)
    .maybeSingle();

  if (courseError) {
    throw new WeeklyCoursePulseError(
      "database_lookup_failed",
      `Weekly pulse course lookup failed: ${courseError.message}`
    );
  }
  if (!course) {
    throw new WeeklyCoursePulseError(
      "course_not_found",
      `Course not found for uuid ${input.courseUuid}`
    );
  }

  const courseRow = course as DbCourseRow;

  const [syllabusResult, gradeResult, studyPlanResult, assignmentsResult, courseCanvasSettings] = await Promise.all([
    supabase
      .from("syllabus")
      .select("course_id, break_down, exam_dates, project_date, cut_off, topic_outline")
      .eq("course_id", courseRow.course_id)
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
    getCourseCanvasSettings(input.courseUuid),
  ]);

  if (syllabusResult.error) {
    throw new WeeklyCoursePulseError(
      "database_lookup_failed",
      `Weekly pulse syllabus lookup failed: ${syllabusResult.error.message}`
    );
  }
  if (gradeResult.error) {
    throw new WeeklyCoursePulseError(
      "database_lookup_failed",
      `Weekly pulse grade lookup failed: ${gradeResult.error.message}`
    );
  }
  if (studyPlanResult.error) {
    throw new WeeklyCoursePulseError(
      "database_lookup_failed",
      `Weekly pulse study plan lookup failed: ${studyPlanResult.error.message}`
    );
  }
  if (assignmentsResult.error) {
    throw new WeeklyCoursePulseError(
      "database_lookup_failed",
      `Weekly pulse assignments lookup failed: ${assignmentsResult.error.message}`
    );
  }

  const dbAssignments = (assignmentsResult.data ?? []) as DbAssignmentRow[];
  const assignmentsPastWeek = dbAssignments.filter((item) => isWithinWindow(item.due_at, pastStart, pastEnd));
  const assignmentsNextWeek = dbAssignments.filter((item) => isWithinWindow(item.due_at, futureStart, futureEnd));

  let canvasAssignmentsPastWeek: CanvasAssignmentSummary[] = [];
  let canvasAssignmentsNextWeek: CanvasAssignmentSummary[] = [];
  let canvasModules: CanvasModuleSummary[] = [];

  const effectiveCanvasBaseUrl =
    input.canvasBaseUrl ?? courseCanvasSettings?.canvas_base_url ?? undefined;
  const effectiveCanvasCourseId =
    input.canvasCourseId ?? courseCanvasSettings?.canvas_course_id ?? undefined;

  if (effectiveCanvasBaseUrl && input.canvasAccessToken && effectiveCanvasCourseId) {
    try {
      const [canvasAssignments, modules] = await Promise.all([
        fetchCanvasAssignments(effectiveCanvasBaseUrl, effectiveCanvasCourseId, input.canvasAccessToken),
        fetchCanvasModules(effectiveCanvasBaseUrl, effectiveCanvasCourseId, input.canvasAccessToken),
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
      throw new WeeklyCoursePulseError(
        "canvas_enrichment_unavailable",
        err instanceof Error ? err.message : "Canvas enrichment failed"
      );
    }
  }

  const moduleTopicSignals = buildCanvasModuleTopicSignals(
    canvasModules,
    pastStart,
    pastEnd,
    futureStart,
    futureEnd
  );
  const syllabusTopicSignals = buildSyllabusTopicSignals(syllabusResult.data?.topic_outline, {
    anchorDate: anchorPoint,
    pastStart,
    pastEnd,
    futureStart,
    futureEnd,
    canvasModules,
    dbAssignments,
    canvasAssignmentsPastWeek,
    canvasAssignmentsNextWeek,
  });
  const assignmentPastTopicSignals = buildAssignmentTopicSignals(assignmentsPastWeek);
  const assignmentNextTopicSignals = buildAssignmentTopicSignals(assignmentsNextWeek);

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
    pastTopicSignals: dedupeTopicSignals([
      ...syllabusTopicSignals.pastTopicSignals,
      ...moduleTopicSignals.pastTopicSignals,
      ...assignmentPastTopicSignals,
    ]),
    nextTopicSignals: dedupeTopicSignals([
      ...syllabusTopicSignals.nextTopicSignals,
      ...moduleTopicSignals.nextTopicSignals,
      ...assignmentNextTopicSignals,
    ]),
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
      usedSyllabus: !!context.syllabus,
      usedAssignments:
        context.assignmentsPastWeek.length > 0 || context.assignmentsNextWeek.length > 0,
      usedGrades: !!context.currentGrade,
      usedStudyPlan: !!context.studyPlan,
      usedCanvasAssignments:
        context.canvasAssignmentsPastWeek.length > 0 || context.canvasAssignmentsNextWeek.length > 0,
      usedCanvasModules: context.canvasModules.length > 0,
    },
    anchorDate,
    pastWindowStart: toIsoDay(pastStart),
    pastWindowEnd: toIsoDay(pastEnd),
    futureWindowStart: toIsoDay(futureStart),
    futureWindowEnd: toIsoDay(futureEnd),
  };
}

function summarizeDbAssignments(assignments: DbAssignmentRow[]) {
  return assignments.slice(0, 6).map((assignment) => ({
    title: assignment.title,
    type: assignment.assignment_type,
    dueAt: assignment.due_at,
    status: assignment.status,
    dependencies: assignment.dependencies ?? [],
  }));
}

function summarizeCanvasAssignments(assignments: CanvasAssignmentSummary[]) {
  return assignments.slice(0, 6).map((assignment) => ({
    name: assignment.name,
    dueAt: assignment.due_at ?? assignment.unlock_at ?? null,
    submissionTypes: assignment.submission_types ?? [],
    pointsPossible: assignment.points_possible ?? null,
  }));
}

function filterSyllabusEventsToWindow(
  value: unknown,
  start: string,
  end: string
) {
  const windowStart = new Date(start);
  const windowEnd = new Date(end);
  return asDatedOutlineItems(value)
    .filter((item) => {
      const parsed = new Date(item.date);
      return !Number.isNaN(parsed.getTime()) && parsed >= windowStart && parsed <= windowEnd;
    })
    .slice(0, 6);
}

function buildPromptContext(gathered: {
  context: WeeklyCoursePulseContext;
  anchorDate: string;
  pastWindowStart: string;
  pastWindowEnd: string;
  futureWindowStart: string;
  futureWindowEnd: string;
}) {
  return {
    course: {
      id: gathered.context.course.course_id,
      name: gathered.context.course.course_name,
      instructor: gathered.context.course.instructor_name,
    },
    windows: {
      anchorDate: gathered.anchorDate,
      pastWindowStart: gathered.pastWindowStart,
      pastWindowEnd: gathered.pastWindowEnd,
      futureWindowStart: gathered.futureWindowStart,
      futureWindowEnd: gathered.futureWindowEnd,
    },
    pastEvidenceCandidates: {
      topicSignals: gathered.context.pastTopicSignals,
      assignments: summarizeDbAssignments(gathered.context.assignmentsPastWeek),
      canvasAssignments: summarizeCanvasAssignments(gathered.context.canvasAssignmentsPastWeek),
      syllabusExams: filterSyllabusEventsToWindow(
        gathered.context.syllabus?.exam_dates,
        gathered.pastWindowStart,
        gathered.pastWindowEnd
      ),
      syllabusProjects: filterSyllabusEventsToWindow(
        gathered.context.syllabus?.project_date,
        gathered.pastWindowStart,
        gathered.pastWindowEnd
      ),
    },
    nextEvidenceCandidates: {
      topicSignals: gathered.context.nextTopicSignals,
      assignments: summarizeDbAssignments(gathered.context.assignmentsNextWeek),
      canvasAssignments: summarizeCanvasAssignments(gathered.context.canvasAssignmentsNextWeek),
      syllabusExams: filterSyllabusEventsToWindow(
        gathered.context.syllabus?.exam_dates,
        gathered.futureWindowStart,
        gathered.futureWindowEnd
      ),
      syllabusProjects: filterSyllabusEventsToWindow(
        gathered.context.syllabus?.project_date,
        gathered.futureWindowStart,
        gathered.futureWindowEnd
      ),
    },
    courseStatus: {
      currentGrade: gathered.context.currentGrade
        ? {
            currentPercent: gathered.context.currentGrade.current_percent,
            currentLetter: gathered.context.currentGrade.current_letter_grade,
          }
        : null,
      studyPlan: gathered.context.studyPlan
        ? {
            title: gathered.context.studyPlan.title,
            type: gathered.context.studyPlan.type,
            priority: gathered.context.studyPlan.priority,
            difficulty: gathered.context.studyPlan.difficulty,
          }
        : null,
    },
  };
}

export async function generateWeeklyCoursePulse(
  input: GenerateWeeklyCoursePulseInput
): Promise<GenerateWeeklyCoursePulseResult> {
  const gathered = await gatherContext(input);
  const generatedAt = toIsoTimestamp(new Date());
  const promptContext = buildPromptContext(gathered);

  const aiConfig = input.aiConfig;
  if (!aiConfig) {
    throw new WeeklyCoursePulseError(
      "llm_generation_failed",
      "Missing AI config for weekly course pulse generation"
    );
  }

  let result;
  try {
    result = await generateObjectWithAI({
      config: aiConfig,
      schema: WeeklyCoursePulseGenerationSchema,
      maxOutputTokens: 4096,
      system:
        "You generate a weekly course pulse for a student support system. " +
        "You must ground everything in the provided evidence only. " +
        "Priority when sources disagree: database > canvas_api > inferred. " +
        "The past section may only use pastEvidenceCandidates. The next section may only use nextEvidenceCandidates. " +
        "Never mention dates or tasks outside the provided past or next candidate buckets. " +
        "pastWeekLearned should explain what the student most likely learned, practiced, read, or completed in the last 7 days. " +
        "nextWeekPreview should explain what content, methods, or concepts the student is likely to study in the next 7 days. " +
        "Prefer concrete learning topics such as ANOVA, regression, optimization, recursion, or thermodynamics over administrative summaries. " +
        "Use assignments and deadlines mainly as supporting evidence for what topic the student was working on. " +
        "If topic signals are present, explicitly name those concepts. " +
        "Use uncertainty language when evidence is sparse. Never invent deadlines, policies, or topics. " +
        "Return concise but specific prose. Keep pastWeekLearned and nextWeekPreview under 120 words each. " +
        "Keep each evidence detail under 140 characters. " +
        "Each evidence list should contain 2-6 grounded items when possible, fewer if the evidence is weak. " +
        "Confidence should be low when the input is sparse and higher only when multiple concrete signals align. " +
        "Return only strict JSON.",
      prompt:
        "Return one JSON object with exactly these top-level keys: " +
        '"pastWeekLearned", "nextWeekPreview", "pastWeekEvidence", "nextWeekEvidence", "confidence".\n\n' +
        "Use topic signals as the first source for content-level summaries. " +
        "Only fall back to deadlines or task logistics when the content signals are weak.\n\n" +
        "Both evidence fields must always be arrays, even when evidence is weak. " +
        "Confidence must always be a number between 0 and 1.\n\n" +
        "Required JSON shape example:\n" +
        JSON.stringify(
          {
            pastWeekLearned: "Short grounded summary.",
            nextWeekPreview: "Short grounded preview.",
            pastWeekEvidence: [
              {
                label: "Example",
                detail: "Short grounded detail.",
                source: "database",
              },
            ],
            nextWeekEvidence: [
              {
                label: "Example",
                detail: "Short grounded detail.",
                source: "canvas_api",
              },
            ],
            confidence: 0.62,
          },
          null,
          2
        ) +
        "\n\nUse only the evidence inside each bucket for that bucket's output. " +
        "If pastEvidenceCandidates is sparse, say the past week evidence is limited instead of borrowing from nextEvidenceCandidates.\n\n" +
        "Structured context:\n" +
        JSON.stringify(promptContext),
    });
  } catch (error) {
    throw new WeeklyCoursePulseError(
      "llm_generation_failed",
      error instanceof Error ? error.message : "LLM generation failed"
    );
  }

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
    model: aiConfig.model,
    sourceSummary: gathered.sourceSummary,
    pulse: result.object,
    rawContext: gathered.context,
  };
}

function toMostRecentFriday(input: Date) {
  const next = new Date(input);
  const day = next.getDay();
  const distance = (day + 2) % 7;
  next.setDate(next.getDate() - distance);
  return next;
}
