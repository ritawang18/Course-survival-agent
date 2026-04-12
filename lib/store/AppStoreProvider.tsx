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
  UploadArtifact,
} from "./types";
import { getSupabaseClient } from "@/lib/supabase/client";

type ToastKind = "info" | "success" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface AppStoreValue {
  data: AppData;
  loading: boolean;
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
  fetchProfessorInsight: (courseId: string) => Promise<void>;
  // toast
  toasts: Toast[];
  pushToast: (t: Omit<Toast, "id">) => void;
  dismissToast: (id: number) => void;
  // state flags
  replanning: boolean;
  syncing: boolean;
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
        if (!res.ok) {
          const { error } = await res
            .json()
            .catch(() => ({ error: "Failed to load data" }));
          throw new Error(error || `HTTP ${res.status}`);
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
      pushToast({
        kind: "info",
        title: "Replan not available yet",
        description: "The study planner isn't wired to real data yet.",
      });
    } finally {
      setReplanning(false);
    }
  }, [pushToast]);

  const addUpload = useCallback((artifact: UploadArtifact) => {
    setData((prev) => ({ ...prev, uploads: [artifact, ...prev.uploads] }));
  }, []);

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
        const res = await fetch("/api/professor-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      pushToast({
        kind: "info",
        title: "Calendar sync not available yet",
        description: "Hook this up to /api/calendar/sync-syllabus next.",
      });
    } finally {
      setSyncing(false);
    }
  }, [pushToast]);

  const value = useMemo<AppStoreValue>(
    () => ({
      data,
      loading,
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      addUpload,
      syncGoogleCalendar,
      fetchProfessorInsight,
      toasts,
      pushToast,
      dismissToast,
      replanning,
      syncing,
      insightsLoading,
    }),
    [
      data,
      loading,
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      addUpload,
      syncGoogleCalendar,
      fetchProfessorInsight,
      toasts,
      pushToast,
      dismissToast,
      replanning,
      syncing,
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
