import { getServiceClient } from "@/lib/supabase/server";

export type CanvasPageType =
  | "dashboard"
  | "course_home"
  | "assignment"
  | "module"
  | "syllabus"
  | "files"
  | "grades"
  | "unknown";

export interface ExtensionCanvasContext {
  url: string;
  origin: string;
  pathname: string;
  pageType: CanvasPageType;
  courseId?: string;
  assignmentId?: string;
  moduleItemId?: string;
  courseName?: string;
  courseCode?: string;
  pageTitle?: string;
  detectedDueText?: string;
  detectedPointsText?: string;
  detectedSubmissionTypeText?: string;
  rubricDetected: boolean;
  fileRestrictionsDetected: boolean;
  peerReviewDetected: boolean;
  mustViewDetected: boolean;
  modulePrerequisiteDetected: boolean;
  latePolicyText?: string;
  attendancePolicyText?: string;
  gradingWeightsText?: string;
  examDatesText?: string;
  folderName?: string;
  nearestDueText?: string;
  dashboardDeadlines: string[];
  modulePastSummary?: string;
  moduleNextSummary?: string;
  rawDomHints: string[];
  detectedAt: string;
}

export interface ExtensionCourseSnapshot {
  courseId?: string;
  courseName?: string;
  courseCode?: string;
  currentPressure?: string;
}

export interface ExtensionAssignmentSnapshot {
  assignmentId?: string;
  name?: string;
  dueAt?: string | null;
  pointsPossible?: number | null;
  submissionTypes?: string[];
  hasRubric?: boolean;
  summary?: string;
}

export interface ExtensionGradeSnapshot {
  currentPercent?: number | null;
  currentLetterGrade?: string | null;
}

export interface RiskAlert {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed?: boolean;
}

export type SummaryDataSource = "database" | "canvas_api" | "dom_fallback";

export interface CardDataSources {
  snapshot: SummaryDataSource;
  risk: SummaryDataSource;
  checklist: SummaryDataSource;
}

export interface ExtensionContextSummaryResponse {
  riskLevel: "low" | "medium" | "high";
  pageSummary: string;
  alerts: RiskAlert[];
  checklist: ChecklistItem[];
  promptSuggestions: string[];
  dataSource: SummaryDataSource;
  cardSources: CardDataSources;
  courseSnapshot?: ExtensionCourseSnapshot;
  assignmentSnapshot?: ExtensionAssignmentSnapshot;
  gradeSnapshot?: ExtensionGradeSnapshot;
  courseMatch?: {
    courseUuid: string;
    courseCode?: string;
    courseName?: string | null;
    matchSource: "canvas_mapping" | "text_match";
  };
  weeklyPulse?: {
    generatedAt?: string | null;
    pastWeekLearned: string;
    nextWeekPreview: string;
  };
  context: ExtensionCanvasContext;
}

interface DbCourseRow {
  id: string;
  course_id: string;
  course_name: string | null;
  instructor_name: string | null;
  attendance_allowed_misses: number | null;
  updated_at?: string | null;
}

interface DbAssignmentRow {
  id: string;
  course_id: string;
  canvas_assignment_id?: string | null;
  title: string;
  assignment_type: string;
  description?: string | null;
  due_at?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  points_possible?: number | null;
  status?: string | null;
  estimated_hours?: number | null;
  dependencies?: string[] | null;
}

interface DbSyllabusRow {
  course_id: string;
  break_down?: Array<{ name?: string; percent?: number; confidence?: number }> | null;
  exam_dates?: Array<{ label?: string; date?: string; confidence?: number }> | null;
  project_date?: Array<{ label?: string; date?: string; confidence?: number }> | null;
  cut_off?: Array<{ grade?: string; minPercent?: number; confidence?: number }> | null;
}

interface DbStudyPlanRow {
  title: string | null;
}

interface DbCourseGradeRow {
  id: string;
  current_percent?: number | null;
  current_letter_grade?: string | null;
  projected_percent?: number | null;
  projected_letter_grade?: string | null;
}

interface DbCourseCanvasSettingsRow {
  course_uuid: string;
  canvas_course_id?: string | null;
  canvas_base_url?: string | null;
}

interface DbWeeklyCoursePulseRow {
  course_uuid: string;
  generated_at: string | null;
  past_week_learned: string;
  next_week_preview: string;
}

interface DbProfessorInsightRow {
  course_id: string | null;
  professor_name: string;
  university_name: string;
  generated_at: string | null;
}

function normalize(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function textScore(target: string | undefined, candidate: string | undefined) {
  const a = normalize(target);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 10;
  if (a.includes(b) || b.includes(a)) return 6;
  const shared = [...new Set(a)].filter((char) => b.includes(char)).length;
  return shared >= Math.min(6, a.length, b.length) ? 2 : 0;
}

function formatDueDate(raw?: string | null) {
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatWeightSummary(weights: DbSyllabusRow["break_down"]) {
  if (!Array.isArray(weights) || weights.length === 0) return undefined;
  return weights
    .map((item) => {
      const name = item.name?.trim();
      const percent = item.percent;
      if (!name || typeof percent !== "number") return null;
      return `${name} ${percent}%`;
    })
    .filter(Boolean)
    .slice(0, 4)
    .join(" · ");
}

function formatExamSummary(exams: DbSyllabusRow["exam_dates"]) {
  if (!Array.isArray(exams) || exams.length === 0) return undefined;
  return exams
    .map((item) => {
      const label = item.label?.trim() || "Exam";
      const date = formatDueDate(item.date);
      return date ? `${label}: ${date}` : label;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function formatAttendanceSummary(course: DbCourseRow | null) {
  if (!course || course.attendance_allowed_misses == null) return undefined;
  return `Allowed misses: ${course.attendance_allowed_misses}`;
}

function formatDeadlineLine(assignment: DbAssignmentRow, course?: DbCourseRow | null) {
  const due = formatDueDate(assignment.due_at);
  const courseLabel = course?.course_id ?? course?.course_name ?? "";
  if (courseLabel && due) return `${assignment.title} - ${courseLabel} - Due ${due}`;
  if (due) return `${assignment.title} - Due ${due}`;
  if (courseLabel) return `${assignment.title} - ${courseLabel}`;
  return assignment.title;
}

function promptsForPage(pageType: CanvasPageType) {
  switch (pageType) {
    case "course_home":
      return [
        "What should I focus on in this course this week?",
        "What risks should I watch?"
      ];
    case "assignment":
      return [
        "Summarize this assignment",
        "What could I miss before submitting?"
      ];
    case "module":
      return [
        "What do I need to complete in this module first?",
        "Are there hidden prerequisites here?"
      ];
    case "syllabus":
      return [
        "What are the most important course rules here?",
        "Summarize the grading and attendance policy."
      ];
    case "files":
      return [
        "Which files here are likely important?",
        "What should I organize or download from this page?"
      ];
    case "grades":
      return [
        "What is my current standing in this course?",
        "What grade risk should I watch right now?"
      ];
    case "dashboard":
      return [
        "What should I do first across my courses?",
        "What is my nearest risk right now?"
      ];
    default:
      return [
        "What matters on this page?",
        "What should I do next?"
      ];
  }
}

function checklistForContext(context: ExtensionCanvasContext): ChecklistItem[] {
  switch (context.pageType) {
    case "course_home":
      return [
        { id: "course-focus", label: "Identify the next major deadline for this course" },
        { id: "course-risk", label: "Check attendance, exams, or grading rules that create immediate risk" },
        { id: "course-next", label: "Choose one concrete next action for this course today" }
      ];
    case "assignment":
      return [
        { id: "assignment-due", label: "Confirm due date and submission time" },
        { id: "assignment-submit", label: "Verify submission type and allowed files" },
        { id: "assignment-rubric", label: "Review rubric and hidden requirements before submitting" }
      ];
    case "module":
      return [
        { id: "module-read", label: "Read all module items in order" },
        { id: "module-unlock", label: "Confirm unlock conditions or prerequisites" },
        { id: "module-links", label: "Check downstream assignment or quiz links" }
      ];
    case "syllabus":
      return [
        { id: "syllabus-attendance", label: "Check attendance policy" },
        { id: "syllabus-grading", label: "Check grading weights" },
        { id: "syllabus-exams", label: "Check exam dates and late policy" }
      ];
    case "files":
      return [
        { id: "files-important", label: "Identify the important file or folder on this page" },
        { id: "files-rename", label: "Note which materials should be organized in the full web app" },
        { id: "files-check", label: "Check whether this folder contains assignment or study-critical materials" }
      ];
    case "grades":
      return [
        { id: "grades-current", label: "Check current percent and letter grade" },
        { id: "grades-risk", label: "Look for any assignments that could lower the current standing" },
        { id: "grades-next", label: "Identify the next graded item that matters most" }
      ];
    case "dashboard":
      return [
        { id: "dash-nearest", label: "Identify the nearest due item across courses" },
        { id: "dash-risk", label: "Look for the course with the highest current pressure" },
        { id: "dash-open", label: "Open the full web app if you need deeper planning" }
      ];
    default:
      return [
        { id: "generic-context", label: "Confirm what this page is asking you to do" },
        { id: "generic-risk", label: "Check for hidden requirements or blockers" },
        { id: "generic-next", label: "Choose the next concrete action" }
      ];
  }
}

function pageSummaryForContext(context: ExtensionCanvasContext) {
  switch (context.pageType) {
    case "course_home":
      return `You are on the course home page${context.courseName ? ` for ${context.courseName}` : ""}. Focus on current pressure and the next critical task, not full-semester planning.`;
    case "assignment":
      return `You are on an assignment page${context.courseName ? ` for ${context.courseName}` : ""}. Prioritize due date, submission type, rubric, and hidden requirements before submitting.`;
    case "module":
      return "You are on a module page. Watch for unlock rules, must-view steps, and downstream assignments or quizzes.";
    case "syllabus":
      return "You are on the syllabus page. Extract the high-level course rules: attendance, grading weights, exams, and late policy.";
    case "files":
      return "You are on a files page. Focus on the current folder context and whether these materials are important for assignments or study.";
    case "grades":
      return "You are on the grades page. Focus on the real current percent, current letter grade, and what upcoming work may change them.";
    case "dashboard":
      return "You are on the Canvas dashboard. Focus on cross-course risk, nearest due item, and whether you should jump into the full web app.";
    default:
      return "You are on a Canvas page. Focus on what matters on this page right now.";
  }
}

async function fetchUserCourses(userId: string): Promise<DbCourseRow[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("courses")
    .select("id, course_id, course_name, instructor_name, attendance_allowed_misses, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  return (data ?? []) as DbCourseRow[];
}

async function findCourseMatch(
  context: ExtensionCanvasContext,
  userId: string,
  userCourses?: DbCourseRow[]
): Promise<{ course: DbCourseRow | null; matchSource?: "canvas_mapping" | "text_match" }> {
  const supabase = getServiceClient();
  const availableCourses = userCourses ?? (await fetchUserCourses(userId));
  if (availableCourses.length === 0) return { course: null };

  if (context.courseId) {
    const { data: mappedSettings } = await supabase
      .from("course_canvas_settings")
      .select("course_uuid, canvas_course_id, canvas_base_url")
      .in(
        "course_uuid",
        availableCourses.map((course) => course.id)
      )
      .eq("canvas_course_id", context.courseId);

    const settingsRows = (mappedSettings ?? []) as DbCourseCanvasSettingsRow[];
    const exactOriginMatch =
      settingsRows.find((row) => row.canvas_base_url?.trim() === context.origin.trim()) ??
      settingsRows.find((row) => !row.canvas_base_url) ??
      settingsRows[0];

    if (exactOriginMatch) {
      const matched = availableCourses.find((course) => course.id === exactOriginMatch.course_uuid);
      if (matched) return { course: matched, matchSource: "canvas_mapping" };
    }
  }

  const exactCourseKeys = [context.courseCode, context.courseName]
    .map((item) => item?.trim())
    .filter(Boolean) as string[];

  for (const courseKey of exactCourseKeys) {
    const candidates = availableCourses.filter(
      (course) => course.course_id === courseKey || course.course_name === courseKey
    );
    if (candidates.length > 0) {
      const best = candidates.sort((a, b) => {
        const aScore = Math.max(
          textScore(context.courseCode, a.course_id),
          textScore(context.courseName, a.course_name ?? a.course_id)
        );
        const bScore = Math.max(
          textScore(context.courseCode, b.course_id),
          textScore(context.courseName, b.course_name ?? b.course_id)
        );
        return bScore - aScore;
      })[0];

      if (
        best &&
        Math.max(
          textScore(context.courseCode, best.course_id),
          textScore(context.courseName, best.course_name ?? best.course_id)
        ) >= 6
      ) {
        return { course: best, matchSource: "text_match" };
      }
    }
  }

  if (context.courseName) {
    const filtered = availableCourses.filter((course) =>
      (course.course_name ?? "").toLowerCase().includes(context.courseName?.toLowerCase() ?? "")
    );

    if (filtered.length > 0) {
      const ranked = filtered
        .map((row) => ({
          row,
          score: Math.max(
            textScore(context.courseName, row.course_name ?? row.course_id),
            textScore(context.courseCode, row.course_id)
          ),
        }))
        .sort((a, b) => b.score - a.score);

      if (ranked[0] && ranked[0].score >= 6) {
        return { course: ranked[0].row, matchSource: "text_match" };
      }
    }
  }

  return { course: null };
}

async function fetchSyllabus(courseKey: string): Promise<DbSyllabusRow | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("syllabus")
    .select("course_id, break_down, exam_dates, project_date, cut_off")
    .eq("course_id", courseKey)
    .limit(1);

  return data && data.length > 0 ? (data[0] as DbSyllabusRow) : null;
}

/** Title of the soonest-scheduled study block for this course, if any. */
async function fetchStudyPlan(courseUuid: string): Promise<DbStudyPlanRow | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("study_plan_blocks")
    .select("title")
    .eq("course_uuid", courseUuid)
    .order("date", { ascending: true })
    .limit(1);

  return data && data.length > 0 ? (data[0] as DbStudyPlanRow) : null;
}

async function fetchCourseGrade(courseUuid: string): Promise<DbCourseGradeRow | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("course_grades")
    .select("id, current_percent, current_letter_grade, projected_percent, projected_letter_grade")
    .eq("id", courseUuid)
    .limit(1);

  return data && data.length > 0 ? (data[0] as DbCourseGradeRow) : null;
}

async function fetchAssignmentsForCourse(courseUuid: string): Promise<DbAssignmentRow[]> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("assignments")
    .select(
      "id, course_id, canvas_assignment_id, title, assignment_type, description, due_at, available_from, available_until, points_possible, status, estimated_hours, dependencies"
    )
    .eq("course_id", courseUuid)
    .order("due_at", { ascending: true });

  return (data ?? []) as DbAssignmentRow[];
}

async function fetchDashboardAssignments(): Promise<Array<DbAssignmentRow & { course?: DbCourseRow | null }>> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("assignments")
    .select(
      "id, course_id, canvas_assignment_id, title, assignment_type, description, due_at, available_from, available_until, points_possible, status, estimated_hours, dependencies, courses:course_id(id, course_id, course_name, instructor_name, attendance_allowed_misses, updated_at)"
    )
    .gte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(6);

  return ((data ?? []) as Array<DbAssignmentRow & { courses?: DbCourseRow | DbCourseRow[] | null }>).map(
    (item) => ({
      ...item,
      course: Array.isArray(item.courses) ? item.courses[0] ?? null : item.courses ?? null
    })
  );
}

async function fetchDashboardAssignmentsForUser(
  userCourses: DbCourseRow[]
): Promise<Array<DbAssignmentRow & { course?: DbCourseRow | null }>> {
  if (userCourses.length === 0) return [];

  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const courseIds = userCourses.map((course) => course.id);
  const courseById = new Map(userCourses.map((course) => [course.id, course]));
  const { data } = await supabase
    .from("assignments")
    .select(
      "id, course_id, canvas_assignment_id, title, assignment_type, description, due_at, available_from, available_until, points_possible, status, estimated_hours, dependencies"
    )
    .in("course_id", courseIds)
    .gte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(6);

  return ((data ?? []) as DbAssignmentRow[]).map((item) => ({
    ...item,
    course: courseById.get(item.course_id) ?? null
  }));
}

async function fetchLatestWeeklyPulse(courseUuid: string): Promise<DbWeeklyCoursePulseRow | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("weekly_course_pulse")
    .select("course_uuid, generated_at, past_week_learned, next_week_preview")
    .eq("course_uuid", courseUuid)
    .order("generated_at", { ascending: false })
    .limit(1);

  return data && data.length > 0 ? (data[0] as DbWeeklyCoursePulseRow) : null;
}

async function fetchLatestProfessorInsight(courseId: string): Promise<DbProfessorInsightRow | null> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("professor_insights")
    .select("course_id, professor_name, university_name, generated_at")
    .eq("course_id", courseId)
    .order("generated_at", { ascending: false })
    .limit(1);

  return data && data.length > 0 ? (data[0] as DbProfessorInsightRow) : null;
}

function findAssignmentMatch(assignments: DbAssignmentRow[], context: ExtensionCanvasContext) {
  if (context.assignmentId) {
    const canvasMatch = assignments.find(
      (assignment) => assignment.canvas_assignment_id === context.assignmentId
    );
    if (canvasMatch) return canvasMatch;
  }

  const title = context.pageTitle;
  let best: DbAssignmentRow | null = null;
  let bestScore = 0;

  for (const assignment of assignments) {
    const score = textScore(title, assignment.title);
    if (score > bestScore) {
      bestScore = score;
      best = assignment;
    }
  }

  return bestScore >= 4 ? best : null;
}

function buildAlerts(
  context: ExtensionCanvasContext,
  assignment: DbAssignmentRow | null
): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (assignment?.description?.trim()) {
    alerts.push({
      id: "implicit-requirements",
      severity: "medium",
      title: "Parsed hidden requirements",
      detail: assignment.description.trim().slice(0, 180)
    });
  }

  if (assignment?.dependencies?.length) {
    alerts.push({
      id: "dependencies",
      severity: "low",
      title: "Concept dependencies detected",
      detail: assignment.dependencies.slice(0, 4).join(", ")
    });
  }

  if (context.rubricDetected) {
    alerts.push({
      id: "rubric",
      severity: "low",
      title: "Rubric detected",
      detail: "Review the rubric before submitting so you do not miss grading criteria."
    });
  }

  if (context.fileRestrictionsDetected) {
    alerts.push({
      id: "files",
      severity: "medium",
      title: "Possible file restrictions",
      detail: "This page suggests allowed file type requirements. Double-check before upload."
    });
  }

  if (context.peerReviewDetected) {
    alerts.push({
      id: "peer-review",
      severity: "medium",
      title: "Peer review detected",
      detail: "This assignment may include a peer review step after submission."
    });
  }

  if (context.modulePrerequisiteDetected || context.mustViewDetected) {
    alerts.push({
      id: "module-prereq",
      severity: "medium",
      title: "Module requirements may block progress",
      detail: "Look for must-view, unlock, or prerequisite requirements before moving on."
    });
  }

  if (context.latePolicyText) {
    alerts.push({
      id: "late-policy",
      severity: "low",
      title: "Late policy mentioned",
      detail: context.latePolicyText
    });
  }

  return alerts;
}

export async function buildExtensionContextSummary(
  incoming: ExtensionCanvasContext,
  userId: string
): Promise<ExtensionContextSummaryResponse> {
  const context: ExtensionCanvasContext = { ...incoming };
  let courseSnapshot: ExtensionCourseSnapshot | undefined;
  let assignmentSnapshot: ExtensionAssignmentSnapshot | undefined;
  let gradeSnapshot: ExtensionGradeSnapshot | undefined;
  let assignmentMatch: DbAssignmentRow | null = null;
  let weeklyPulse: DbWeeklyCoursePulseRow | null = null;
  let professorInsight: DbProfessorInsightRow | null = null;
  let courseMatch:
    | {
        courseUuid: string;
        courseCode?: string;
        courseName?: string | null;
        matchSource: "canvas_mapping" | "text_match";
      }
    | undefined;
  let snapshotSource: SummaryDataSource = "dom_fallback";
  let riskSource: SummaryDataSource = "dom_fallback";
  let checklistSource: SummaryDataSource = "dom_fallback";
  const userCourses = await fetchUserCourses(userId);

  if (context.pageType === "dashboard") {
    const upcomingAssignments = await fetchDashboardAssignmentsForUser(userCourses);
    if (upcomingAssignments.length > 0 && context.dashboardDeadlines.length === 0) {
      const dashboardDeadlines = upcomingAssignments
        .map((item) => formatDeadlineLine(item, item.course))
        .slice(0, 3);

      if (dashboardDeadlines.length > 0) {
        context.dashboardDeadlines = dashboardDeadlines;
        context.nearestDueText = context.nearestDueText ?? dashboardDeadlines[0];
      }
    }

    if (context.dashboardDeadlines.length > 0) {
      courseSnapshot = {
        currentPressure: context.dashboardDeadlines[0]
      };
      snapshotSource = "database";
    }
  }

  const matchResult = await findCourseMatch(context, userId, userCourses);
  const matchedCourse = matchResult.course;
  const syllabus = matchedCourse ? await fetchSyllabus(matchedCourse.course_id) : null;
  const studyPlan = matchedCourse ? await fetchStudyPlan(matchedCourse.id) : null;
  const courseGrade = matchedCourse ? await fetchCourseGrade(matchedCourse.id) : null;
  const assignments = matchedCourse ? await fetchAssignmentsForCourse(matchedCourse.id) : [];
  weeklyPulse = matchedCourse ? await fetchLatestWeeklyPulse(matchedCourse.id) : null;
  professorInsight = matchedCourse ? await fetchLatestProfessorInsight(matchedCourse.course_id) : null;

  if (matchedCourse && matchResult.matchSource) {
    courseMatch = {
      courseUuid: matchedCourse.id,
      courseCode: matchedCourse.course_id,
      courseName: matchedCourse.course_name,
      matchSource: matchResult.matchSource
    };
  }

  if (matchedCourse && assignments.length > 0 && !context.nearestDueText) {
    const firstUpcoming = assignments.find((item) => item.due_at && new Date(item.due_at) >= new Date());
    if (firstUpcoming) {
      context.nearestDueText = formatDeadlineLine(firstUpcoming);
    }
  }

  if (matchedCourse) {
    const nextAssignment = assignments.find((item) => item.due_at && new Date(item.due_at) >= new Date());
    const currentPressure =
      (nextAssignment ? formatDeadlineLine(nextAssignment) : null) ??
      weeklyPulse?.next_week_preview ??
      studyPlan?.title ??
      context.nearestDueText;

    courseSnapshot = {
      courseId: matchedCourse.id,
      courseCode: matchedCourse.course_id,
      courseName: matchedCourse.course_name ?? context.courseName,
      currentPressure: currentPressure ?? undefined
    };
    snapshotSource = "database";

    context.courseCode = matchedCourse.course_id;
    context.courseName = matchedCourse.course_name ?? context.courseName;
    context.attendancePolicyText = formatAttendanceSummary(matchedCourse) ?? context.attendancePolicyText;
    context.gradingWeightsText = formatWeightSummary(syllabus?.break_down) ?? context.gradingWeightsText;
    context.examDatesText = formatExamSummary(syllabus?.exam_dates) ?? context.examDatesText;
    context.nearestDueText = currentPressure ?? context.nearestDueText;

    if (weeklyPulse && context.pageType === "course_home") {
      context.modulePastSummary = context.modulePastSummary ?? weeklyPulse.past_week_learned;
      context.moduleNextSummary = context.moduleNextSummary ?? weeklyPulse.next_week_preview;
    }

    if (assignments.length > 1 && context.pageType === "module") {
      const sorted = assignments.filter((item) => item.due_at).sort((a, b) => {
        return new Date(a.due_at ?? "").valueOf() - new Date(b.due_at ?? "").valueOf();
      });
      const firstUpcomingIndex = sorted.findIndex((item) => item.due_at && new Date(item.due_at) >= new Date());
      if (firstUpcomingIndex > 0) {
        context.modulePastSummary = `Last important item: ${sorted[firstUpcomingIndex - 1].title}`;
      }
      if (firstUpcomingIndex >= 0 && firstUpcomingIndex < sorted.length) {
        context.moduleNextSummary = `Next important item: ${sorted[firstUpcomingIndex].title}`;
      }
    }

    if (weeklyPulse && context.pageType === "module") {
      context.modulePastSummary = context.modulePastSummary ?? weeklyPulse.past_week_learned;
      context.moduleNextSummary = context.moduleNextSummary ?? weeklyPulse.next_week_preview;
    }
  }

  if (context.pageType === "assignment" && assignments.length > 0) {
    assignmentMatch = findAssignmentMatch(assignments, context);

    if (assignmentMatch) {
      assignmentSnapshot = {
        assignmentId: assignmentMatch.id,
        name: assignmentMatch.title,
        dueAt: assignmentMatch.due_at ?? null,
        pointsPossible: assignmentMatch.points_possible ?? null,
        hasRubric: context.rubricDetected,
        summary: assignmentMatch.description ?? undefined
      };

      context.pageTitle = assignmentMatch.title;
      context.detectedDueText = assignmentMatch.due_at ?? context.detectedDueText;
      context.detectedPointsText =
        assignmentMatch.points_possible != null
          ? `${assignmentMatch.points_possible} points`
          : context.detectedPointsText;
      snapshotSource = "database";
    }
  }

  if (context.pageType === "grades" && courseGrade) {
    gradeSnapshot = {
      currentPercent: courseGrade.current_percent ?? null,
      currentLetterGrade: courseGrade.current_letter_grade ?? null
    };
    snapshotSource = "database";
  }

  const alerts = buildAlerts(context, assignmentMatch);
  if (weeklyPulse && context.pageType === "course_home") {
    alerts.unshift({
      id: "weekly-pulse",
      severity: "low",
      title: "Weekly pulse available",
      detail: `Next focus: ${weeklyPulse.next_week_preview}`
    });
    riskSource = "database";
  }
  if (professorInsight) {
    alerts.push({
      id: "insight-available",
      severity: "low",
      title: "Instructor insight cached in Web UI",
      detail: `Insight is available for ${professorInsight.professor_name}. Open the Web UI for the full summary.`
    });
    riskSource = "database";
  }
  if (assignmentMatch?.description?.trim() || assignmentMatch?.dependencies?.length) {
    riskSource = "database";
  }

  if (matchedCourse && context.pageType === "syllabus") {
    checklistSource = "database";
  }

  const pageSummary =
    weeklyPulse && context.pageType === "course_home"
      ? `Last week: ${weeklyPulse.past_week_learned}\n\nNext week: ${weeklyPulse.next_week_preview}`
      : pageSummaryForContext(context);

  return {
    riskLevel:
      context.pageType === "assignment" || alerts.some((item) => item.severity !== "low")
        ? "medium"
        : "low",
    pageSummary,
    alerts,
    checklist: checklistForContext(context),
    promptSuggestions: promptsForPage(context.pageType),
    dataSource:
      snapshotSource === "database" || riskSource === "database" || checklistSource === "database"
        ? "database"
        : "dom_fallback",
    cardSources: {
      snapshot: snapshotSource,
      risk: riskSource,
      checklist: checklistSource
    },
    courseSnapshot,
    assignmentSnapshot,
    gradeSnapshot,
    courseMatch,
    weeklyPulse:
      weeklyPulse
        ? {
            generatedAt: weeklyPulse.generated_at,
            pastWeekLearned: weeklyPulse.past_week_learned,
            nextWeekPreview: weeklyPulse.next_week_preview
          }
        : undefined,
    context
  };
}

function extractAssignmentRequirements(assignment: DbAssignmentRow | null) {
  if (!assignment?.description?.trim()) return "No parsed assignment requirements were found in the database.";
  return assignment.description.trim();
}

export async function buildAskAgentContext(incoming: ExtensionCanvasContext, userId: string) {
  const summary = await buildExtensionContextSummary(incoming, userId);
  const matchedCourse = summary.courseSnapshot?.courseId
    ? {
        id: summary.courseSnapshot.courseId,
        name: summary.courseSnapshot.courseName,
        code: summary.courseSnapshot.courseCode
      }
    : null;

  let assignmentRequirements = "No assignment-specific database context was found.";
  if (summary.assignmentSnapshot?.assignmentId && matchedCourse?.id) {
    const assignments = await fetchAssignmentsForCourse(matchedCourse.id);
    const assignment = assignments.find((item) => item.id === summary.assignmentSnapshot?.assignmentId) ?? null;
    assignmentRequirements = extractAssignmentRequirements(assignment);
  }

  return {
    summary,
    matchedCourse,
    assignmentRequirements
  };
}
