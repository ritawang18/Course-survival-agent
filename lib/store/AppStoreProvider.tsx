"use client";

import React, {
  createContext,
  useCallback,
  useContext,
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
import { seedData } from "@/lib/mock";
import { simulateDelay } from "@/lib/utils/fakeAsync";

type ToastKind = "info" | "success" | "warning" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface AppStoreValue {
  data: AppData;
  // actions
  markAttendance: (courseId: string, attended: boolean) => void;
  setAssignmentStatus: (id: string, status: AssignmentStatus) => void;
  updateGradeScore: (
    courseId: string,
    categoryId: string,
    earned: number | undefined
  ) => void;
  replanStudy: () => Promise<void>;
  simulateUpload: (fileName: string) => Promise<void>;
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

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(seedData);
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

  const markAttendance = useCallback(
    (courseId: string, attended: boolean) => {
      setData((prev) => ({
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? {
                ...c,
                missedClasses: Math.max(
                  0,
                  c.missedClasses + (attended ? 0 : 1)
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
          ? `${course.code} · ${attended ? "Marked present" : "One more absence counted"}`
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
    await simulateDelay(900, 1400);
    // shuffle study blocks deterministically by rotating start times slightly
    setData((prev) => ({
      ...prev,
      studyBlocks: prev.studyBlocks.map((b, i) =>
        b.type === "study"
          ? {
              ...b,
              start: rotateTime(b.start, (i % 3) * 15),
              end: rotateTime(b.end, (i % 3) * 15),
            }
          : b
      ),
    }));
    setReplanning(false);
    pushToast({
      kind: "success",
      title: "Study plan replanned",
      description: "Optimized around new assignments and upcoming exams.",
    });
  }, [pushToast]);

  const simulateUpload = useCallback(
    async (fileName: string) => {
      const id = `u-${Date.now()}`;
      const placeholder: UploadArtifact = {
        id,
        fileName,
        kind: fileName.toLowerCase().includes("syllabus") ? "syllabus" : "notes",
        status: "parsing",
        uploadedAt: new Date().toISOString(),
        extracted: {
          deadlines: [],
          weights: [],
          examDates: [],
          attendancePolicy: { text: "", confidence: 0 },
        },
      };
      setData((prev) => ({ ...prev, uploads: [placeholder, ...prev.uploads] }));
      await simulateDelay(1200, 2000);
      setData((prev) => ({
        ...prev,
        uploads: prev.uploads.map((u) =>
          u.id === id
            ? {
                ...u,
                status: "parsed",
                extracted: {
                  deadlines: [
                    { label: "Assignment 1", date: inDays(5), confidence: 0.94 },
                    { label: "Assignment 2", date: inDays(12), confidence: 0.9 },
                  ],
                  weights: [
                    { name: "Homework", percent: 30, confidence: 0.96 },
                    { name: "Midterm", percent: 25, confidence: 0.92 },
                    { name: "Final", percent: 35, confidence: 0.9 },
                    { name: "Participation", percent: 10, confidence: 0.78 },
                  ],
                  examDates: [
                    { label: "Midterm", date: inDays(18), confidence: 0.88 },
                  ],
                  attendancePolicy: {
                    text: "Up to 3 absences permitted without penalty.",
                    confidence: 0.82,
                  },
                },
              }
            : u
        ),
      }));
      pushToast({
        kind: "success",
        title: "Parsing complete",
        description: `${fileName} extracted successfully.`,
      });
    },
    [pushToast]
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
    await simulateDelay(1000, 1800);
    setSyncing(false);
    pushToast({
      kind: "success",
      title: "Calendar synced",
      description: "Google Calendar events imported and conflicts flagged.",
    });
  }, [pushToast]);

  const value = useMemo<AppStoreValue>(
    () => ({
      data,
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      simulateUpload,
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
      markAttendance,
      setAssignmentStatus,
      updateGradeScore,
      replanStudy,
      simulateUpload,
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

// ——— helpers ———

function rotateTime(hhmm: string, addMinutes: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h * 60 + m + addMinutes) % (24 * 60);
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

function inDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

// Re-export for consumers
export function useCourse(courseId: string | undefined): Course | undefined {
  const { data } = useAppStore();
  return data.courses.find((c) => c.id === courseId);
}
