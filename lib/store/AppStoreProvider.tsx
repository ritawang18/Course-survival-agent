"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  AppData,
  Assignment,
  AssignmentStatus,
  Course,
  InstructorInsight,
  StudyBlock,
  UploadArtifact,
} from "./types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { buildCalendarExportEvents } from "@/lib/calendar/export-events";
import type { FreeWindow, SchedulerInput } from "@/lib/scheduler";

type ToastKind = "info" | "success" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface CalendarEventResponse {
  id: string;
  summary: string;
  start: string;
  end: string;
}

interface PlannerResponse {
  studyBlocks?: Array<
    Partial<StudyBlock> & {
      id?: string;
      courseId?: string;
      course_id?: string;
    }
  >;
  reasoning?: string;
  warnings?: string[];
  error?: string;
}

function toEventKey(event: { summary: string; start: string; end: string }) {
  return `${event.summary}__${event.start}__${event.end}`;
}

function estimateDifficulty(assignment: Assignment): NonNullable<StudyBlock["difficulty"]> {
  if (/exam|midterm|final|project/i.test(assignment.assignment_type)) return "hard";
  if (/lab|essay|paper/i.test(assignment.assignment_type)) return "medium";
  if ((assignment.estimated_hours ?? 0) >= 4) return "hard";
  if ((assignment.estimated_hours ?? 0) >= 2) return "medium";
  return "easy";
}

function estimatePriority(dueAt?: string): NonNullable<StudyBlock["priority"]> {
  if (!dueAt) return "optional";
  const now = Date.now();
  const dueMs = new Date(dueAt).getTime();
  const diffDays = (dueMs - now) / (1000 * 60 * 60 * 24);
  if (diffDays <= 3) return "urgent";
  if (diffDays <= 7) return "important";
  return "optional";
}

function buildFallbackFreeWindows(days = 7): FreeWindow[] {
  const windows: FreeWindow[] = [];
  const anchor = new Date();

  for (let offset = 0; offset < days; offset += 1) {
    const current = new Date(anchor);
    current.setDate(anchor.getDate() + offset);
    const weekday = current.getDay();
    const date = current.toISOString().slice(0, 10);
    const weekend = weekday === 0 || weekday === 6;

    windows.push({
      date,
      slots: weekend
        ? [
            { start: "10:00", end: "12:00" },
            { start: "14:00", end: "16:00" },
          ]
        : [
            { start: "17:30", end: "19:00" },
            { start: "19:30", end: "21:30" },
          ],
    });
  }

  return windows;
}

function normalizeStudyBlocks(rawBlocks: PlannerResponse["studyBlocks"]): StudyBlock[] {
  return (rawBlocks ?? [])
    .map((block, index) => {
      const courseId = block.course_id ?? block.courseId;
      const date = typeof block.date === "string" ? block.date.slice(0, 10) : undefined;
      const start = typeof block.start === "string" ? block.start.slice(0, 5) : undefined;
      const end = typeof block.end === "string" ? block.end.slice(0, 5) : undefined;

      if (!courseId || !date || !start || !end || !block.title || !block.type) {
        return null;
      }

      const normalizedBlock: StudyBlock = {
        id: block.id ?? `study-block-${Date.now()}-${index}`,
        course_id: courseId,
        title: block.title,
        date,
        start,
        end,
        type: block.type,
        difficulty: block.difficulty,
        priority: block.priority,
        conflict: Boolean(block.conflict),
      };

      return normalizedBlock;
    })
    .filter((block): block is StudyBlock => block !== null);
}

interface AppStoreValue {
  data: AppData;
  loading: boolean;
  refreshData: () => Promise<void>;
  // actions
  markAttendance: (courseId: string, attended: boolean) => void;
  setAssignmentStatus: (id: string, status: AssignmentStatus) => void;
  updateGradeScore: (
    courseId: string,
    categoryId: string,
    earned: number | undefined
  ) => void;
  replanStudy: () => Promise<void>;
  addUpload: (artifact: UploadArtifact) => void;
  syncGoogleCalendar: () => Promise<void>;
  refreshWeeklyCoursePulse: (courseId: string) => Promise<void>;
  fetchProfessorInsight: (courseId: string) => Promise<void>;
  // toast
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  // state flags
  replanning: boolean;
  syncing: boolean;
  pulseLoading: Record<string, boolean>;
  insightsLoading: Record<string, boolean>;
}

const emptyData: AppData = {
  courses: [],
  assignments: [],
  exams: [],
  studyBlocks: [],
  uploads: [],
  insights: [],
};

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [replanning, setReplanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulseLoading, setPulseLoading] = useState<Record<string, boolean>>({});
  const [insightsLoading, setInsightsLoading] = useState<Record<string, boolean>>({});

  const pushToast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const loadAppData = useCallback(async (token: string) => {
    const res = await fetch("/api/me/data", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const { error } = await res
        .json()
        .catch(() => ({ error: "Failed to load data" }));
      throw new Error(error || `HTTP ${res.status}`);
    }

    return (await res.json()) as AppData;
  }, []);

  const refreshData = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error("You must be signed in to refresh your data.");
    }

    const payload = await loadAppData(token);
    setData(payload);
  }, [loadAppData]);

  // ── Hydrate from Supabase on mount ───────────────────────────────────────
  // Also re-runs when the auth state changes, so signing in/out swaps the
  // dataset without a page reload.
  useEffect(() => {
    const supabase = getSupabaseClient();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          if (!cancelled) setData(emptyData);
          return;
        }
        const res = await fetch("/api/me/data", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          // Server rejected our token — almost always a stale `sb-*` session
          // from a different Supabase project. Burn it down so the user
          // doesn't have to manually clear site data.
          console.warn("[store] 401 on hydrate — clearing stale session");
          await supabase.auth.signOut();
          Object.keys(localStorage)
            .filter((k) => k.startsWith("sb-"))
            .forEach((k) => localStorage.removeItem(k));
          if (!cancelled) {
            setData(emptyData);
            pushToast({
              kind: "warning",
              title: "Session expired",
              description: "Please sign in again.",
            });
          }
          return;
        }
        const payload = (await res.json()) as AppData;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) {
          console.error("[store] hydrate failed", err);
          pushToast({
            kind: "error",
            title: "Could not load your data",
            description: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [pushToast]);

  const markAttendance = useCallback(
    (courseId: string, attended: boolean) => {
      setData((prev) => ({
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                attendance_missed_count: Math.max(
                  0,
                  c.attendance_missed_count + (attended ? 0 : 1)
                ),
              }
            : c
        ),
      }));
      const course = data.courses.find((c) => c.id === courseId);
      pushToast({
        kind: attended ? "success" : "warning",
        title: attended ? "Attendance logged" : "Absence recorded",
        description: course
          ? `${course.code ?? course.course_id ?? ""} · ${attended ? "Marked present" : "One more absence counted"}`
          : undefined,
      });
    },
    [data.courses, pushToast]
  );

  const setAssignmentStatus = useCallback(
    (id: string, status: AssignmentStatus) => {
      setData((prev) => ({
        ...prev,
        assignments: prev.assignments.map((a) =>
          a.id === id ? { ...a, status } : a
        ),
      }));
    },
    []
  );

  const updateGradeScore = useCallback(
    (courseId: string, categoryId: string, earned: number | undefined) => {
      setData((prev) => ({
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                gradingWeights: c.gradingWeights.map((g) =>
                  g.id === categoryId ? { ...g, earned } : g
                ),
              }
            : c
        ),
      }));
    },
    []
  );

  const replanStudy = useCallback(async () => {
    setReplanning(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("You must be signed in to generate a study plan.");
      }

      const actionableAssignments = data.assignments.filter(
        (assignment) => assignment.status !== "done" && !!assignment.due_at
      );
      const actionableExams = data.exams.filter(
        (exam) => new Date(exam.date).getTime() >= Date.now()
      );

      if (actionableAssignments.length === 0 && actionableExams.length === 0) {
        pushToast({
          kind: "info",
          title: "Nothing to plan yet",
          description: "Add upcoming assignments or exams first, then generate a study plan.",
        });
        return;
      }

      let freeWindows = buildFallbackFreeWindows(7);
      try {
        const freebusyRes = await fetch(
          "/api/calendar/freebusy?days=7&dayStart=8&dayEnd=22&minMinutes=45"
        );
        if (freebusyRes.ok) {
          const freebusyJson = (await freebusyRes.json()) as {
            freeWindows?: FreeWindow[];
          };
          if (Array.isArray(freebusyJson.freeWindows) && freebusyJson.freeWindows.length > 0) {
            freeWindows = freebusyJson.freeWindows;
          }
        }
      } catch (err) {
        console.warn("[store] planner freebusy fallback", err);
      }

      const plannerInput: SchedulerInput = {
        assignments: actionableAssignments.map((assignment) => ({
          id: assignment.id,
          courseId: assignment.course_id,
          title: assignment.title,
          dueDate: assignment.due_at!,
          estimatedHours: assignment.estimated_hours ?? 2,
          difficulty: estimateDifficulty(assignment),
          priority: estimatePriority(assignment.due_at),
          status: assignment.status,
        })),
        exams: actionableExams.map((exam) => ({
          id: exam.id,
          courseId: exam.course_id,
          title: exam.title,
          date: exam.date,
          weight: exam.weight,
          topics: exam.topics,
        })),
        courses: data.courses.map((course) => ({
          id: course.id,
          uuid: course.id,
          code: course.code ?? course.course_id ?? course.id,
          name: course.name ?? course.course_name ?? course.code ?? course.id,
          schedule: course.schedule || "Schedule unavailable",
        })),
        freeWindows,
        horizonDays: 7,
      };

      const res = await fetch("/api/planner/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(plannerInput),
      });

      const json = (await res.json().catch(() => null)) as PlannerResponse | null;
      if (!res.ok) {
        throw new Error(json?.error ?? "Failed to generate study plan.");
      }

      const studyBlocks = normalizeStudyBlocks(json?.studyBlocks);
      if (studyBlocks.length === 0) {
        throw new Error("Planner returned no valid study blocks.");
      }

      const refreshed = await loadAppData(token).catch(() => data);
      setData({
        ...refreshed,
        studyBlocks,
      });

      pushToast({
        kind: "success",
        title: "Study plan refreshed",
        description:
          json?.warnings && json.warnings.length > 0
            ? json.warnings[0]
            : `Generated ${studyBlocks.length} study block${studyBlocks.length === 1 ? "" : "s"} for this week.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Could not generate study plan",
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setReplanning(false);
    }
  }, [data, loadAppData, pushToast]);

  const addUpload = useCallback((artifact: UploadArtifact) => {
    setData((prev) => ({ ...prev, uploads: [artifact, ...prev.uploads] }));
  }, []);

  const refreshWeeklyCoursePulse = useCallback(
    async (courseId: string) => {
      const course = data.courses.find((c) => c.id === courseId);
      if (!course) {
        pushToast({
          kind: "error",
          title: "Could not refresh weekly pulse",
          description: "Course not found.",
        });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        pushToast({
          kind: "error",
          title: "Could not refresh weekly pulse",
          description: "You must be signed in.",
        });
        return;
      }

      setPulseLoading((prev) => ({ ...prev, [courseId]: true }));
      try {
        const res = await fetch("/api/weekly-course-pulse/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            courseUuid: courseId,
            forceRefresh: true,
          }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json?.pulse) {
          throw new Error(json?.error ?? "Failed to generate weekly course pulse.");
        }

        const nextPulse = json.pulse;
        setData((prev) => ({
          ...prev,
          courses: prev.courses.map((item) =>
            item.id === courseId
              ? {
                  ...item,
                  weeklyPulse: nextPulse,
                  aiSummary: `Last week: ${nextPulse.pulse.pastWeekLearned}\n\nNext week: ${nextPulse.pulse.nextWeekPreview}`,
                }
              : item
          ),
        }));

        pushToast({
          kind: json.cached ? "info" : "success",
          title: json.cached ? "Loaded weekly pulse" : "Weekly pulse refreshed",
          description: `${course.code ?? course.course_id ?? "Course"} · ${Math.round(nextPulse.pulse.confidence * 100)}% confidence`,
        });
      } catch (err) {
        pushToast({
          kind: "error",
          title: "Could not refresh weekly pulse",
          description: err instanceof Error ? err.message : "Unexpected error",
        });
      } finally {
        setPulseLoading((prev) => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      }
    },
    [data.courses, pushToast]
  );

  const fetchProfessorInsight = useCallback(
    async (courseId: string) => {
      const course = data.courses.find((c) => c.id === courseId);
      if (!course) {
        pushToast({
          kind: "error",
          title: "Could not fetch insights",
          description: "Course not found.",
        });
        return;
      }
      if (!course.instructor || !course.school) {
        pushToast({
          kind: "error",
          title: "Could not fetch insights",
          description: "Missing professor or school for this course.",
        });
        return;
      }

      setInsightsLoading((prev) => ({ ...prev, [courseId]: true }));
      try {
        const supabase = getSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const res = await fetch("/api/professor-insights", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            professorName: course.instructor,
            universityName: course.school,
            courseId,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          const reason = (json && json.reason) || "internal";
          pushToast({
            kind: "error",
            title: "Could not fetch insights",
            description: `Reason: ${reason}`,
          });
          return;
        }
        const insight: InstructorInsight = { ...json.insight, courseId };
        setData((prev) => {
          const exists = prev.insights.some((i) => i.courseId === courseId);
          return {
            ...prev,
            insights: exists
              ? prev.insights.map((i) => (i.courseId === courseId ? insight : i))
              : [...prev.insights, insight],
          };
        });
        pushToast({
          kind: json.cached ? "info" : "success",
          title: json.cached ? "Loaded cached insight" : "Insight refreshed",
          description: `${course.instructor} · ${course.school}`,
        });
      } catch (err) {
        pushToast({
          kind: "error",
          title: "Could not fetch insights",
          description:
            err instanceof Error && /fetch|network/i.test(err.message)
              ? "Network error"
              : "Unexpected error",
        });
      } finally {
        setInsightsLoading((prev) => {
          const next = { ...prev };
          delete next[courseId];
          return next;
        });
      }
    },
    [data.courses, pushToast]
  );

  const syncGoogleCalendar = useCallback(async () => {
    setSyncing(true);
    try {
      const desiredEvents = [
        ...buildCalendarExportEvents(data),
      ];

      if (desiredEvents.length === 0) {
        pushToast({
          kind: "info",
          title: "Nothing to sync",
          description: "No upcoming study blocks or exams are available to send to Google Calendar.",
        });
        return;
      }

      const eventsRes = await fetch("/api/calendar/events?days=30");
      if (eventsRes.status === 401) {
        const authRes = await fetch("/api/calendar/auth");
        const authJson = await authRes.json().catch(() => null);
        const url = authJson?.url;

        if (authRes.ok && typeof url === "string") {
          pushToast({
            kind: "info",
            title: "Connect Google Calendar",
            description: "Redirecting to Google authorization.",
          });
          window.location.assign(url);
          return;
        }

        throw new Error("Google Calendar is not connected yet.");
      }

      if (!eventsRes.ok) {
        const { error } = await eventsRes.json().catch(() => ({ error: "Failed to list Google Calendar events" }));
        throw new Error(error);
      }

      const existingPayload = (await eventsRes.json()) as { events?: CalendarEventResponse[] };
      const existingKeys = new Set(
        (existingPayload.events ?? []).map((event) => toEventKey(event))
      );

      const pendingEvents = desiredEvents.filter(
        (event) => !existingKeys.has(toEventKey(event))
      );

      if (pendingEvents.length === 0) {
        pushToast({
          kind: "success",
          title: "Calendar already up to date",
          description: "Upcoming study blocks and exams are already present in Google Calendar.",
        });
        return;
      }

      let createdCount = 0;
      for (const event of pendingEvents) {
        const createRes = await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event),
        });

        if (createRes.status === 401) {
          const authRes = await fetch("/api/calendar/auth");
          const authJson = await authRes.json().catch(() => null);
          const url = authJson?.url;

          if (authRes.ok && typeof url === "string") {
            pushToast({
              kind: "info",
              title: "Reconnect Google Calendar",
              description: "Your calendar session expired. Redirecting to Google authorization.",
            });
            window.location.assign(url);
            return;
          }

          throw new Error("Google Calendar authorization expired.");
        }

        if (!createRes.ok) {
          const { error } = await createRes.json().catch(() => ({ error: `Failed to create event: ${event.summary}` }));
          throw new Error(error);
        }

        createdCount += 1;
      }

      pushToast({
        kind: "success",
        title: "Google Calendar synced",
        description: `Created ${createdCount} new calendar event${createdCount === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Calendar sync failed",
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setSyncing(false);
    }
  }, [data, pushToast]);

  const value = useMemo<AppStoreValue>(
    () => ({
      data,
      loading,
      refreshData,
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      addUpload,
      syncGoogleCalendar,
      refreshWeeklyCoursePulse,
      fetchProfessorInsight,
      toasts,
      pushToast,
      dismissToast,
      replanning,
      syncing,
      pulseLoading,
      insightsLoading,
    }),
    [
      data,
      loading,
      refreshData,
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      addUpload,
      syncGoogleCalendar,
      refreshWeeklyCoursePulse,
      fetchProfessorInsight,
      toasts,
      pushToast,
      dismissToast,
      replanning,
      syncing,
      pulseLoading,
      insightsLoading,
    ]
  );

  return (
    <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider");
  return ctx;
}

// Re-export for consumers
export function useCourse(courseId: string | undefined): Course | undefined {
  const { data } = useAppStore();
  return data.courses.find((c) => c.id === courseId);
}
