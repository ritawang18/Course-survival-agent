import type {
  CanvasAssignmentSnapshot,
  CanvasCourseSnapshot,
  CanvasGradeSnapshot,
  CanvasPageContext
} from "../types/canvas";

interface CanvasEnrichment {
  courseSnapshot?: CanvasCourseSnapshot;
  assignmentSnapshot?: CanvasAssignmentSnapshot;
  gradeSnapshot?: CanvasGradeSnapshot;
  nearestDueText?: string;
  dashboardDeadlines?: string[];
  modulePastSummary?: string;
  moduleNextSummary?: string;
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Canvas API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchCanvasEnrichment(
  context: CanvasPageContext,
  token: string
): Promise<CanvasEnrichment | null> {
  const baseEnrichment: CanvasEnrichment = {};

  const dashboardEnrichment = await fetchDashboardTodoEnrichment(context.origin, token);
  if (dashboardEnrichment) {
    baseEnrichment.nearestDueText = dashboardEnrichment.nearestDueText;
    baseEnrichment.dashboardDeadlines = dashboardEnrichment.dashboardDeadlines;
    baseEnrichment.courseSnapshot = {
      currentPressure: dashboardEnrichment.nearestDueText
    };
  }

  if (!context.courseId) {
    return Object.keys(baseEnrichment).length > 0 ? baseEnrichment : null;
  }

  try {
    const course = await fetchJson<{
      id: number;
      name?: string;
      course_code?: string;
    }>(`${context.origin}/api/v1/courses/${context.courseId}`, token);

    const courseSnapshot: CanvasCourseSnapshot = {
      courseId: String(course.id),
      courseName: course.name,
      courseCode: course.course_code,
      currentPressure: baseEnrichment.courseSnapshot?.currentPressure
    };

    if (context.pageType === "grades") {
      const gradeSnapshot = await fetchGradeSnapshot(context.origin, context.courseId, token);
      return { ...baseEnrichment, courseSnapshot, gradeSnapshot };
    }

    if (context.pageType === "module") {
      const moduleSnapshot = await fetchModuleSummaries(context.origin, context.courseId, token);
      return { ...baseEnrichment, courseSnapshot, ...moduleSnapshot };
    }

    if (!context.assignmentId) {
      return { ...baseEnrichment, courseSnapshot };
    }

    const assignment = await fetchJson<{
      id: number;
      name?: string;
      due_at?: string | null;
      points_possible?: number | null;
      submission_types?: string[];
      rubric?: unknown[];
    }>(
      `${context.origin}/api/v1/courses/${context.courseId}/assignments/${context.assignmentId}`,
      token
    );

    const assignmentSnapshot: CanvasAssignmentSnapshot = {
      assignmentId: String(assignment.id),
      name: assignment.name,
      dueAt: assignment.due_at,
      pointsPossible: assignment.points_possible,
      submissionTypes: assignment.submission_types,
      hasRubric: Array.isArray(assignment.rubric) && assignment.rubric.length > 0,
      summary: undefined
    };

    return {
      ...baseEnrichment,
      courseSnapshot,
      assignmentSnapshot
    };
  } catch {
    return Object.keys(baseEnrichment).length > 0 ? baseEnrichment : null;
  }
}

interface EnrollmentRow {
  computed_current_score?: number | null;
  computed_current_grade?: string | null;
}

async function fetchGradeSnapshot(origin: string, courseId: string, token: string) {
  try {
    const rows = await fetchJson<EnrollmentRow[]>(
      `${origin}/api/v1/courses/${courseId}/enrollments?user_id=self&type[]=StudentEnrollment`,
      token
    );

    const row = rows[0];
    if (!row) return undefined;

    return {
      currentPercent: row.computed_current_score ?? null,
      currentLetterGrade: row.computed_current_grade ?? null
    } satisfies CanvasGradeSnapshot;
  } catch {
    return undefined;
  }
}

interface CanvasModule {
  id: number;
  name?: string | null;
}

async function fetchModuleSummaries(origin: string, courseId: string, token: string) {
  try {
    const modules = await fetchJson<CanvasModule[]>(
      `${origin}/api/v1/courses/${courseId}/modules?per_page=10`,
      token
    );

    if (!Array.isArray(modules) || modules.length === 0) return {};

    return {
      modulePastSummary: modules[0]?.name ? `Last module focus: ${modules[0].name}` : undefined,
      moduleNextSummary: modules[1]?.name ? `Next module focus: ${modules[1].name}` : undefined
    };
  } catch {
    return {};
  }
}

interface PlannerItem {
  plannable_date?: string | null;
  todo_date?: string | null;
  html_url?: string | null;
  context_name?: string | null;
  plannable_type?: string | null;
  plannable?: {
    title?: string | null;
    name?: string | null;
  } | null;
  assignment?: {
    name?: string | null;
    due_at?: string | null;
  } | null;
}

interface TodoItem {
  html_url?: string | null;
  assignment?: {
    name?: string | null;
    due_at?: string | null;
  } | null;
}

function formatDueDate(rawDate?: string | null) {
  if (!rawDate) return null;

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.valueOf())) return rawDate;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatTodoLine(title?: string | null, courseName?: string | null, rawDate?: string | null) {
  const safeTitle = title?.trim() || "Untitled task";
  const safeCourse = courseName?.trim();
  const safeDate = formatDueDate(rawDate);

  if (safeCourse && safeDate) return `${safeTitle} - ${safeCourse} - Due ${safeDate}`;
  if (safeDate) return `${safeTitle} - Due ${safeDate}`;
  if (safeCourse) return `${safeTitle} - ${safeCourse}`;
  return safeTitle;
}

async function fetchDashboardTodoEnrichment(origin: string, token: string) {
  try {
    const plannerItems = await fetchJson<PlannerItem[]>(
      `${origin}/api/v1/planner/items?order=asc&per_page=10`,
      token
    );

    const dashboardDeadlines = plannerItems
      .map((item) =>
        formatTodoLine(
          item.plannable?.title ?? item.plannable?.name ?? item.assignment?.name,
          item.context_name,
          item.plannable_date ?? item.todo_date ?? item.assignment?.due_at
        )
      )
      .filter(Boolean)
      .slice(0, 3) as string[];

    if (dashboardDeadlines.length > 0) {
      return {
        nearestDueText: dashboardDeadlines[0],
        dashboardDeadlines
      };
    }
  } catch {
    // Fall through to the older todo endpoint.
  }

  try {
    const todoItems = await fetchJson<TodoItem[]>(`${origin}/api/v1/users/self/todo`, token);
    const dashboardDeadlines = todoItems
      .map((item) => formatTodoLine(item.assignment?.name, undefined, item.assignment?.due_at))
      .filter(Boolean)
      .slice(0, 3) as string[];

    if (dashboardDeadlines.length > 0) {
      return {
        nearestDueText: dashboardDeadlines[0],
        dashboardDeadlines
      };
    }
  } catch {
    return null;
  }

  return null;
}
