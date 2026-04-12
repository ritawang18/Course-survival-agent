import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getUserFromRequest } from "@/lib/supabase/server";
import type {
  AppData,
  Assignment,
  AssignmentStatus,
  Course,
  Exam,
  GradingCategory,
  InstructorInsight,
  LectureModule,
  StudyBlock,
  UploadArtifact,
  UploadedFile,
} from "@/lib/store/types";
import type { WeeklyCoursePulseRecord } from "@/lib/schemas/weekly-course-pulse";

export const runtime = "nodejs";

interface DbCourseRow {
  id: string;
  course_id: string;
  course_name: string | null;
  instructor_name: string | null;
  attendance_allowed_misses: number | null;
  created_at: string | null;
}

interface DbAssignmentRow {
  id: string;
  course_id: string;
  title: string;
  assignment_type: string;
  due_at: string | null;
  status: string | null;
  points_possible: number | null;
  estimated_hours: number | null;
  description: string | null;
  dependencies: string[] | null;
}

interface DbSyllabusRow {
  course_id: string;
  break_down: unknown;
  exam_dates: unknown;
  project_date: unknown;
  cut_off: unknown;
}

interface DbCourseGradeRow {
  id: string;
  current_percent: number | null;
  current_letter_grade: string | null;
  projected_percent: number | null;
  projected_letter_grade: string | null;
}

interface DbStudyPlanRow {
  id: string;
  course_id: string;
  title: string | null;
  type: string | null;
  priority: string | null;
  difficulty: string | null;
}

interface DbStudyPlanBlockRow {
  id: string;
  course_uuid: string;
  course_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  priority: string | null;
  difficulty: string | null;
  conflict: boolean | null;
}

interface DbProfessorInsightRow {
  course_id: string | null;
  professor_name: string;
  university_name: string;
  generated_at: string | null;
  rmp: InstructorInsight["rmp"];
  reddit: InstructorInsight["reddit"];
  raw_sources?: InstructorInsight["sources"] | null;
}

interface DbWeeklyCoursePulseRow {
  course_uuid: string;
  course_id: string;
  course_name: string | null;
  anchor_date: string;
  past_window_start: string;
  past_window_end: string;
  future_window_start: string;
  future_window_end: string;
  generated_at: string | null;
  model: string | null;
  source_summary: WeeklyCoursePulseRecord["sourceSummary"] | null;
  past_week_learned: string;
  next_week_preview: string;
  past_week_evidence: WeeklyCoursePulseRecord["pulse"]["pastWeekEvidence"] | null;
  next_week_evidence: WeeklyCoursePulseRecord["pulse"]["nextWeekEvidence"] | null;
  confidence: number | null;
}

function mapDbPulseRowToRecord(row: DbWeeklyCoursePulseRow): WeeklyCoursePulseRecord {
  return {
    courseUuid: row.course_uuid,
    courseId: row.course_id,
    courseName: row.course_name,
    anchorDate: row.anchor_date,
    pastWindowStart: row.past_window_start,
    pastWindowEnd: row.past_window_end,
    futureWindowStart: row.future_window_start,
    futureWindowEnd: row.future_window_end,
    generatedAt: row.generated_at ?? new Date().toISOString(),
    model: row.model,
    sourceSummary:
      row.source_summary ?? {
        hasDatabaseContext: true,
        hasCanvasApiContext: false,
      },
    pulse: {
      pastWeekLearned: row.past_week_learned,
      nextWeekPreview: row.next_week_preview,
      pastWeekEvidence: row.past_week_evidence ?? [],
      nextWeekEvidence: row.next_week_evidence ?? [],
      confidence: row.confidence ?? 0,
    },
  };
}

const palette: Course["color"][] = [
  "indigo",
  "emerald",
  "amber",
  "rose",
  "sky",
  "violet",
];

const DEFAULT_UNIVERSITY_NAME =
  process.env.DEFAULT_UNIVERSITY_NAME ??
  process.env.NEXT_PUBLIC_DEFAULT_UNIVERSITY_NAME ??
  "Washington University in St. Louis";

function isOptionalSourceError(error: { code?: string; message: string } | null) {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist|could not find|schema cache/i.test(error.message)
  );
}

async function resolveOptionalRows<T>(
  promise: PromiseLike<{
    data: T[] | null;
    error: { code?: string; message: string } | null;
  }>,
  label: string
): Promise<T[]> {
  const { data, error } = await promise;
  if (error) {
    if (isOptionalSourceError(error)) {
      console.warn(`[me/data] optional source unavailable: ${label}: ${error.message}`);
      return [];
    }
    throw new Error(`load ${label} failed: ${error.message}`);
  }
  return (data ?? []) as T[];
}

function asObjectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function parseGradingWeights(raw: unknown): GradingCategory[] {
  return asObjectArray(raw)
    .map((item, index) => {
      const name = asString(item.name);
      const weight = asNumber(item.percent);
      if (!name || weight == null) return null;
      return {
        id: slugify(name) || `weight-${index + 1}`,
        name,
        weight,
      };
    })
    .filter((item): item is GradingCategory => item !== null);
}

function inferExamWeight(label: string, weights: GradingCategory[]): number {
  const exact = weights.find((item) => normalize(item.name) === normalize(label));
  if (exact) return exact.weight;

  const fuzzy = weights.find((item) => {
    const a = normalize(item.name);
    const b = normalize(label);
    return a.includes(b) || b.includes(a);
  });
  return fuzzy?.weight ?? 0;
}

function parseExamRows(
  courseUuid: string,
  courseId: string,
  rawExamDates: unknown,
  weights: GradingCategory[]
): Exam[] {
  return asObjectArray(rawExamDates).reduce<Exam[]>((acc, item, index) => {
      const label = asString(item.label) ?? `Exam ${index + 1}`;
      const date = asString(item.date);
      if (!date) return acc;
      acc.push({
        id: `${courseUuid}:exam:${index + 1}`,
        course_id: courseUuid,
        title: label,
        date,
        location: courseId,
        weight: inferExamWeight(label, weights),
        topics: [],
      });
      return acc;
    }, []);
}

function deriveAssignmentExams(assignments: Assignment[]): Exam[] {
  return assignments
    .filter((item) => /exam|midterm|final/i.test(item.assignment_type) || /exam|midterm|final/i.test(item.title))
    .filter((item) => !!item.due_at)
    .map((item) => ({
      id: `${item.id}:derived-exam`,
      course_id: item.course_id,
      title: item.title,
      date: item.due_at!,
      location: "",
      weight: 0,
      topics: [],
    }));
}

function dedupeExams(exams: Exam[]): Exam[] {
  const seen = new Set<string>();
  return exams.filter((exam) => {
    const key = `${exam.course_id}:${normalize(exam.title)}:${exam.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDate(dateIso: string, days: number) {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.valueOf())) return formatIsoDate(addDays(new Date(), days));
  return formatIsoDate(addDays(parsed, days));
}

function examLabelToQuestion(label: string) {
  if (/final/i.test(label)) return "What should I master before the final?";
  if (/midterm/i.test(label)) return "What topics are most likely to matter on the midterm?";
  return `What should I review before ${label}?`;
}

function buildStudyBlocksFromRows(input: {
  courseRows: DbCourseRow[];
  assignmentsByCourse: Map<string, Assignment[]>;
  examsByCourse: Map<string, Exam[]>;
  studyPlanByCourseUuid: Map<string, DbStudyPlanRow>;
}): StudyBlock[] {
  const today = new Date();

  return input.courseRows.flatMap((courseRow, index) => {
    const plan = input.studyPlanByCourseUuid.get(courseRow.id);
    if (!plan?.title) return [];

    const nextAssignment = (input.assignmentsByCourse.get(courseRow.id) ?? [])
      .filter((assignment) => assignment.status !== "done" && !!assignment.due_at)
      .sort((a, b) => new Date(a.due_at!).valueOf() - new Date(b.due_at!).valueOf())[0];

    const nextExam = (input.examsByCourse.get(courseRow.id) ?? [])
      .filter((exam) => new Date(exam.date).valueOf() >= today.valueOf())
      .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf())[0];

    const anchorDate =
      nextAssignment?.due_at ??
      nextExam?.date ??
      formatIsoDate(addDays(today, index));

    const blockDate = shiftDate(anchorDate, plan.priority === "urgent" ? -2 : -1);
    const start =
      plan.difficulty === "hard"
        ? "09:00"
        : plan.priority === "urgent"
          ? "17:30"
          : "19:00";
    const end =
      start === "09:00" ? "11:00" : start === "17:30" ? "19:00" : "20:30";

    return [
      {
        id: `${courseRow.id}:study-plan`,
        course_id: courseRow.id,
        title: plan.title,
        date: blockDate,
        start,
        end,
        type: "study",
        priority:
          plan.priority === "urgent" || plan.priority === "important" || plan.priority === "optional"
            ? plan.priority
            : undefined,
        difficulty:
          plan.difficulty === "easy" || plan.difficulty === "medium" || plan.difficulty === "hard"
            ? plan.difficulty
            : undefined,
        conflict: false,
      },
    ];
  });
}

function buildPersistedStudyBlocks(rows: DbStudyPlanBlockRow[]): StudyBlock[] {
  return rows.map((row) => ({
    id: row.id,
    course_id: row.course_uuid,
    title: row.title,
    date: row.date,
    start: row.start_time.slice(0, 5),
    end: row.end_time.slice(0, 5),
    type: row.type as StudyBlock["type"],
    priority:
      row.priority === "urgent" || row.priority === "important" || row.priority === "optional"
        ? row.priority
        : undefined,
    difficulty:
      row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard"
        ? row.difficulty
        : undefined,
    conflict: row.conflict ?? false,
  }));
}

function buildDerivedFiles(
  courseRow: DbCourseRow,
  syllabus: DbSyllabusRow | undefined,
  assignments: Assignment[]
): UploadedFile[] {
  const files: UploadedFile[] = [];

  if (syllabus) {
    const pagesEstimate =
      asObjectArray(syllabus.break_down).length +
      asObjectArray(syllabus.exam_dates).length +
      asObjectArray(syllabus.project_date).length;

    files.push({
      id: `${courseRow.id}:syllabus`,
      name: `${courseRow.course_id} syllabus`,
      uploadedAt: courseRow.created_at ?? new Date().toISOString(),
      kind: "syllabus",
      pages: Math.max(1, pagesEstimate),
    });
  }

  assignments
    .filter((assignment) => !!assignment.description)
    .slice(0, 3)
    .forEach((assignment) => {
      files.push({
        id: `${assignment.id}:artifact`,
        name: assignment.title,
        uploadedAt: assignment.due_at ?? courseRow.created_at ?? new Date().toISOString(),
        kind: "assignment",
        pages: 1,
      });
    });

  return files;
}

function buildDerivedModules(
  pulse: DbWeeklyCoursePulseRow | undefined,
  assignments: Assignment[]
): LectureModule[] {
  const modules: LectureModule[] = [];

  if (pulse?.past_week_learned) {
    modules.push({
      id: `${pulse.course_uuid}:recent`,
      title: pulse.past_week_learned.slice(0, 80),
      week: Math.max(1, new Date(pulse.past_window_end).getUTCDate() % 12),
      status: "done",
      resources: Math.max(1, pulse.past_week_evidence?.length ?? 1),
    });
  }

  const inProgressAssignment = assignments.find((assignment) => assignment.status === "in_progress");
  if (inProgressAssignment) {
    modules.push({
      id: `${inProgressAssignment.id}:current`,
      title: inProgressAssignment.title,
      week: Math.max(1, new Date().getUTCDate() % 12),
      status: "in_progress",
      resources: Math.max(1, inProgressAssignment.dependencies?.length ?? 1),
    });
  }

  if (pulse?.next_week_preview) {
    modules.push({
      id: `${pulse.course_uuid}:next`,
      title: pulse.next_week_preview.slice(0, 80),
      week: Math.max(1, new Date(pulse.future_window_end).getUTCDate() % 12),
      status: "upcoming",
      resources: Math.max(1, pulse.next_week_evidence?.length ?? 1),
    });
  }

  return modules.slice(0, 3);
}

function buildMockExamQuestions(
  exams: Exam[],
  pulse: DbWeeklyCoursePulseRow | undefined
) {
  const sourceText =
    pulse?.next_week_preview ??
    pulse?.past_week_learned ??
    "Review the core concepts, recent assignments, and rubric language before the next assessment.";

  return exams.slice(0, 2).map((exam) => ({
    q: examLabelToQuestion(exam.title),
    a: sourceText,
  }));
}

function buildUploadArtifacts(
  courseRows: DbCourseRow[],
  syllabusByCourseId: Map<string, DbSyllabusRow>
): UploadArtifact[] {
  return courseRows.flatMap((courseRow) => {
    const syllabus = syllabusByCourseId.get(courseRow.course_id);
    if (!syllabus) return [];

    return [
      {
        id: `${courseRow.id}:upload`,
        fileName: `${courseRow.course_id}-syllabus`,
        kind: "syllabus",
        status: "parsed",
        uploadedAt: courseRow.created_at ?? new Date().toISOString(),
        extracted: {
          deadlines: asObjectArray(syllabus.project_date)
            .map((item) => {
              const label = asString(item.label);
              const date = asString(item.date);
              const confidence = asNumber(item.confidence);
              if (!label || !date || confidence == null) return null;
              return { label, date, confidence };
            })
            .filter((item): item is { label: string; date: string; confidence: number } => item !== null),
          weights: asObjectArray(syllabus.break_down)
            .map((item) => {
              const name = asString(item.name);
              const percent = asNumber(item.percent);
              const confidence = asNumber(item.confidence) ?? 0.8;
              if (!name || percent == null) return null;
              return { name, percent, confidence };
            })
            .filter((item): item is { name: string; percent: number; confidence: number } => item !== null),
          examDates: asObjectArray(syllabus.exam_dates)
            .map((item) => {
              const label = asString(item.label);
              const date = asString(item.date);
              const confidence = asNumber(item.confidence) ?? 0.8;
              if (!label || !date) return null;
              return { label, date, confidence };
            })
            .filter((item): item is { label: string; date: string; confidence: number } => item !== null),
          cutoffs: asObjectArray(syllabus.cut_off)
            .map((item) => {
              const grade = asString(item.grade);
              const minPercent = asNumber(item.minPercent);
              const confidence = asNumber(item.confidence) ?? 0.8;
              if (!grade || minPercent == null) return null;
              return { grade, minPercent, confidence };
            })
            .filter((item): item is { grade: string; minPercent: number; confidence: number } => item !== null),
          attendancePolicy: {
            text: "Parsed from the stored syllabus record.",
            confidence: 0.7,
          },
        },
      },
    ];
  });
}

function buildAiSummary(input: {
  pulse?: DbWeeklyCoursePulseRow;
  weights: GradingCategory[];
  attendanceAllowedMisses: number;
  exams: Exam[];
  studyPlan?: DbStudyPlanRow;
}): string {
  const { pulse, weights, attendanceAllowedMisses, exams, studyPlan } = input;
  if (pulse) {
    return `Last week: ${pulse.past_week_learned}\n\nNext week: ${pulse.next_week_preview}`;
  }

  const parts: string[] = [];
  if (weights.length > 0) {
    parts.push(
      `Grading breakdown: ${weights
        .slice(0, 4)
        .map((item) => `${item.name} ${item.weight}%`)
        .join(" · ")}`
    );
  }
  if (exams.length > 0) {
    parts.push(`Upcoming exam signals: ${exams.slice(0, 2).map((item) => item.title).join(" · ")}`);
  }
  if (attendanceAllowedMisses > 0) {
    parts.push(`Allowed absences: ${attendanceAllowedMisses}`);
  }
  if (studyPlan?.title) {
    parts.push(`Current study focus: ${studyPlan.title}`);
  }
  return parts.join(". ");
}

function buildOfficeHourQuestions(input: {
  pulse?: DbWeeklyCoursePulseRow;
  assignments: Assignment[];
  currentPercent?: number | null;
}): string[] {
  const questions: string[] = [];
  const nextDue = [...input.assignments]
    .filter((item) => item.status !== "done" && !!item.due_at)
    .sort((a, b) => new Date(a.due_at!).valueOf() - new Date(b.due_at!).valueOf())[0];

  if (nextDue) {
    questions.push(`What is the most common mistake students make on ${nextDue.title}?`);
  }
  if (input.currentPercent != null && input.currentPercent < 85) {
    questions.push("Given my current grade, which topic should I prioritize before the next assessment?");
  }
  if (input.pulse?.next_week_preview) {
    questions.push("What should I understand best before next week's material starts?");
  }
  return uniqueStrings(questions).slice(0, 3);
}

function buildDependencyNotes(assignments: Assignment[]) {
  const notes = assignments.flatMap((assignment) =>
    (assignment.dependencies ?? []).map((dependency) => ({
      from: dependency,
      to: assignment.title,
      why: "Recorded in assignment dependency metadata.",
    }))
  );

  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${normalize(note.from)}:${normalize(note.to)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapProfessorInsights(rows: DbProfessorInsightRow[]): InstructorInsight[] {
  const latestByCourse = new Map<string, DbProfessorInsightRow>();
  for (const row of rows) {
    if (!row.course_id || latestByCourse.has(row.course_id)) continue;
    latestByCourse.set(row.course_id, row);
  }

  return [...latestByCourse.entries()].map(([courseId, row]) => ({
    courseId,
    professorName: row.professor_name,
    universityName: row.university_name,
    generatedAt: row.generated_at ?? undefined,
    rmp: row.rmp ?? null,
    reddit: row.reddit ?? null,
    sources: row.raw_sources ?? undefined,
  }));
}

/**
 * GET /api/me/data
 *
 * Required sources:
 * - courses
 * - assignments
 * - syllabus
 *
 * Optional sources:
 * - course_grades
 * - study_plan
 * - professor_insights
 * - weekly_course_pulse
 *
 * The optional sources enrich the payload when available, but they should not
 * make the whole hydration route fail on environments where those tables have
 * not been provisioned yet.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getServiceClient();

    const { data: courseRows, error: courseError } = await supabase
      .from("courses")
      .select(
        "id, course_id, course_name, instructor_name, attendance_allowed_misses, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (courseError) {
      throw new Error(`load courses failed: ${courseError.message}`);
    }

    const normalizedCourseRows = (courseRows ?? []) as DbCourseRow[];
    if (normalizedCourseRows.length === 0) {
      const emptyPayload: AppData = {
        courses: [],
        assignments: [],
        exams: [],
        studyBlocks: [],
        uploads: [],
        insights: [],
      };
      return NextResponse.json(emptyPayload);
    }

    const courseUuids = normalizedCourseRows.map((row) => row.id);
    const textCourseIds = normalizedCourseRows.map((row) => row.course_id);

    const [
      assignmentRows,
      syllabusRows,
      gradeRows,
      studyPlanRows,
      studyPlanBlockRows,
      professorInsightRows,
      pulseRows,
    ] = await Promise.all([
      resolveOptionalRows<DbAssignmentRow>(
        supabase
          .from("assignments")
          .select(
            "id, course_id, title, assignment_type, due_at, status, points_possible, estimated_hours, description, dependencies"
          )
          .in("course_id", courseUuids),
        "assignments"
      ),
      resolveOptionalRows<DbSyllabusRow>(
        supabase
          .from("syllabus")
          .select("course_id, break_down, exam_dates, project_date, cut_off")
          .in("course_id", textCourseIds),
        "syllabus"
      ),
      resolveOptionalRows<DbCourseGradeRow>(
        supabase
          .from("course_grades")
          .select("id, current_percent, current_letter_grade, projected_percent, projected_letter_grade")
          .in("id", courseUuids),
        "course_grades"
      ),
      resolveOptionalRows<DbStudyPlanRow>(
        supabase
          .from("study_plan")
          .select("id, course_id, title, type, priority, difficulty")
          .in("id", courseUuids),
        "study_plan"
      ),
      resolveOptionalRows<DbStudyPlanBlockRow>(
        supabase
          .from("study_plan_blocks")
          .select(
            "id, course_uuid, course_id, title, date, start_time, end_time, type, priority, difficulty, conflict"
          )
          .in("course_uuid", courseUuids)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true }),
        "study_plan_blocks"
      ),
      resolveOptionalRows<DbProfessorInsightRow>(
        supabase
          .from("professor_insights")
          .select(
            "course_id, professor_name, university_name, generated_at, rmp, reddit, raw_sources"
          )
          .in("course_id", courseUuids)
          .order("generated_at", { ascending: false }),
        "professor_insights"
      ),
      resolveOptionalRows<DbWeeklyCoursePulseRow>(
        supabase
          .from("weekly_course_pulse")
          .select(
            [
              "course_uuid",
              "course_id",
              "course_name",
              "anchor_date",
              "past_window_start",
              "past_window_end",
              "future_window_start",
              "future_window_end",
              "generated_at",
              "model",
              "source_summary",
              "past_week_learned",
              "next_week_preview",
              "past_week_evidence",
              "next_week_evidence",
              "confidence",
            ].join(", ")
          )
          .in("course_uuid", courseUuids)
          .order("anchor_date", { ascending: false })
          .order("generated_at", { ascending: false }) as unknown as PromiseLike<{
            data: DbWeeklyCoursePulseRow[] | null;
            error: { code?: string; message: string } | null;
          }>,
        "weekly_course_pulse"
      ),
    ]);

    const assignments: Assignment[] = assignmentRows.map((row) => ({
      id: row.id,
      course_id: row.course_id,
      title: row.title,
      assignment_type: row.assignment_type,
      description: row.description ?? undefined,
      due_at: row.due_at ?? undefined,
      points_possible: row.points_possible ?? undefined,
      status: (row.status as AssignmentStatus) ?? "not_started",
      estimated_hours: row.estimated_hours ?? undefined,
      dependencies: row.dependencies ?? [],
    }));

    const assignmentsByCourse = new Map<string, Assignment[]>();
    for (const assignment of assignments) {
      const bucket = assignmentsByCourse.get(assignment.course_id) ?? [];
      bucket.push(assignment);
      assignmentsByCourse.set(assignment.course_id, bucket);
    }

    const syllabusByCourseId = new Map(
      syllabusRows.map((row) => [row.course_id, row] as const)
    );
    const gradesByCourseUuid = new Map(
      gradeRows.map((row) => [row.id, row] as const)
    );
    const studyPlanByCourseUuid = new Map(
      studyPlanRows.map((row) => [row.id, row] as const)
    );

    const latestPulseByCourseUuid = new Map<string, DbWeeklyCoursePulseRow>();
    for (const row of pulseRows) {
      if (!latestPulseByCourseUuid.has(row.course_uuid)) {
        latestPulseByCourseUuid.set(row.course_uuid, row);
      }
    }

    const insights = mapProfessorInsights(professorInsightRows);
    const insightsByCourseUuid = new Map(
      insights.map((row) => [row.courseId!, row] as const)
    );

    const exams = dedupeExams(
      normalizedCourseRows.flatMap((courseRow) => {
        const syllabus = syllabusByCourseId.get(courseRow.course_id);
        const weights = parseGradingWeights(syllabus?.break_down);
        const syllabusExams = parseExamRows(
          courseRow.id,
          courseRow.course_id,
          syllabus?.exam_dates,
          weights
        );
        const derivedAssignmentExams = deriveAssignmentExams(
          assignmentsByCourse.get(courseRow.id) ?? []
        );
        return [...syllabusExams, ...derivedAssignmentExams];
      })
    );

    const examsByCourse = new Map<string, Exam[]>();
    for (const exam of exams) {
      const bucket = examsByCourse.get(exam.course_id) ?? [];
      bucket.push(exam);
      examsByCourse.set(exam.course_id, bucket);
    }

    const courses: Course[] = normalizedCourseRows.map((row, index) => {
      const syllabus = syllabusByCourseId.get(row.course_id);
      const weights = parseGradingWeights(syllabus?.break_down);
      const grade = gradesByCourseUuid.get(row.id);
      const pulse = latestPulseByCourseUuid.get(row.id);
      const studyPlan = studyPlanByCourseUuid.get(row.id);
      const courseAssignments = assignmentsByCourse.get(row.id) ?? [];
      const courseExams = examsByCourse.get(row.id) ?? [];
      const insight = insightsByCourseUuid.get(row.id);
      const derivedFiles = buildDerivedFiles(row, syllabus, courseAssignments);
      const derivedModules = buildDerivedModules(pulse, courseAssignments);
      const derivedMockExamQuestions = buildMockExamQuestions(courseExams, pulse);

      const attendanceAllowed = row.attendance_allowed_misses ?? 0;
      const currentGradePercent =
        grade?.current_percent ?? grade?.projected_percent ?? undefined;

      return {
        id: row.id,
        code: row.course_id,
        name: row.course_name ?? row.course_id,
        instructor: row.instructor_name ?? undefined,
        school: insight?.universityName ?? DEFAULT_UNIVERSITY_NAME,
        color: palette[index % palette.length],
        user_id: user.id,
        course_id: row.course_id,
        course_name: row.course_name ?? row.course_id,
        instructor_name: row.instructor_name ?? undefined,
        credits: 0,
        schedule: "",
        current_grade_percent: currentGradePercent,
        attendance_missed_count: 0,
        attendance_allowed_misses: attendanceAllowed,
        attendancePolicy: {
          attendance_allowed_misses: attendanceAllowed,
          penaltyPerAbsence: 0,
          note:
            attendanceAllowed > 0
              ? `Allowed absences: ${attendanceAllowed}`
              : "No parsed attendance allowance yet.",
        },
        gradingWeights: weights.map((weight) => ({
          ...weight,
          earned: undefined,
        })),
        files: derivedFiles,
        modules: derivedModules,
        aiSummary: buildAiSummary({
          pulse,
          weights,
          attendanceAllowedMisses: attendanceAllowed,
          exams: courseExams,
          studyPlan,
        }),
        weeklyPulse: pulse ? mapDbPulseRowToRecord(pulse) : undefined,
        officeHourQuestions: buildOfficeHourQuestions({
          pulse,
          assignments: courseAssignments,
          currentPercent: grade?.current_percent,
        }),
        mockExamQuestions: derivedMockExamQuestions,
        dependencyNotes: buildDependencyNotes(courseAssignments),
      };
    });

    const persistedStudyBlocks = buildPersistedStudyBlocks(studyPlanBlockRows);
    const persistedCourses = new Set(persistedStudyBlocks.map((block) => block.course_id));
    const fallbackStudyBlocks = buildStudyBlocksFromRows({
      courseRows: normalizedCourseRows.filter((row) => !persistedCourses.has(row.id)),
      assignmentsByCourse,
      examsByCourse,
      studyPlanByCourseUuid,
    });
    const studyBlocks = [...persistedStudyBlocks, ...fallbackStudyBlocks];

    const payload: AppData = {
      courses,
      assignments,
      exams,
      studyBlocks,
      uploads: buildUploadArtifacts(normalizedCourseRows, syllabusByCourseId),
      insights,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[me/data]", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
