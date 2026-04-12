"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { UploadArtifact } from "@/lib/store/types";

type UploadKind = "syllabus" | "assignment";

interface UploadResponse {
  kind: UploadKind;
  fileName: string;
  courseId?: string;
  assignmentsCreated?: number;
  assignmentId?: string;
  extracted: {
    deadlines?: { label: string; date: string; confidence: number }[];
    weights?: { name: string; percent: number; confidence: number }[];
    examDates?: { label: string; date: string; confidence: number }[];
    cutoffs?: { grade: string; minPercent: number; confidence: number }[];
    attendancePolicy?: { text: string; confidence: number };
  };
}

export function UploadZone() {
  const { data, pushToast, addUpload, refreshData } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<UploadKind>("syllabus");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  useEffect(() => {
    if (!selectedCourseId && data.courses.length > 0) {
      setSelectedCourseId(data.courses[0].id);
    }
  }, [data.courses, selectedCourseId]);

  const uploadFile = async (
    file: File,
    kind: UploadKind,
    courseId?: string
  ): Promise<UploadResponse> => {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    if (kind === "assignment" && courseId) {
      form.append("course_id", courseId);
    }

    // Forward the Supabase session JWT so the route's getUserFromRequest
    // gate doesn't 401 us.
    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      throw new Error(
        "You're not signed in. Log in and try again so the upload can be saved."
      );
    }

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (res.status === 401) {
      // Stale session from a different Supabase project (or a token whose
      // `sub` no longer exists in auth.users). Clear it so the next retry
      // starts clean instead of repeatedly 401-ing on the same bad token.
      await supabase.auth.signOut();
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
      throw new Error("Your session expired. Please sign in again and retry.");
    }
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(error);
    }
    return res.json();
  };

  const buildArtifact = (file: File, payload: UploadResponse): UploadArtifact => ({
    id: `u-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    fileName: payload.fileName ?? file.name,
    kind: payload.kind === "assignment" ? "assignment" : "syllabus",
    status: "parsed",
    uploadedAt: new Date().toISOString(),
    extracted: {
      deadlines: payload.extracted.deadlines ?? [],
      weights: payload.extracted.weights ?? [],
      examDates: payload.extracted.examDates ?? [],
      cutoffs: payload.extracted.cutoffs ?? [],
      attendancePolicy: payload.extracted.attendancePolicy ?? {
        text: "",
        confidence: 0,
      },
    },
  });

  const handleFiles = async (files: FileList | File[]) => {
    if (uploadKind === "assignment" && !selectedCourseId) {
      pushToast({
        kind: "error",
        title: "Choose a course first",
        description: "Assignment uploads must be attached to an existing course.",
      });
      return;
    }

    setUploading(true);
    const arr = Array.from(files);
    for (const file of arr) {
      try {
        const payload = await uploadFile(
          file,
          uploadKind,
          uploadKind === "assignment" ? selectedCourseId : undefined
        );
        addUpload(buildArtifact(file, payload));
        await refreshData().catch((err) => {
          console.warn("[upload] refreshData failed", err);
        });
        pushToast({
          kind: "success",
          title: "Parsing complete",
          description: `${file.name} extracted successfully.`,
        });
      } catch (err) {
        pushToast({
          kind: "error",
          title: "Upload failed",
          description: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
    setUploading(false);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "card-surface p-8 flex flex-col items-center text-center border-2 border-dashed transition-all",
        dragging
          ? "border-accent bg-[hsl(var(--accent-soft))]/40"
          : "border-border/70"
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--accent-soft))] flex items-center justify-center mb-3">
        <UploadCloud className="h-6 w-6 text-accent" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        Drop syllabi, notes, or assignment PDFs
      </h3>
      <p className="text-sm text-muted mt-1 max-w-sm">
        We&rsquo;ll extract deadlines, grading weights, exam dates, and attendance
        policies automatically.
      </p>

      <div className="w-full max-w-md mt-5 text-left space-y-3">
        <div>
          <label className="text-xs font-medium">Upload type</label>
          <select
            value={uploadKind}
            onChange={(e) => setUploadKind(e.target.value as UploadKind)}
            className="mt-1.5 h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
          >
            <option value="syllabus">Syllabus / course file</option>
            <option value="assignment">Assignment file</option>
          </select>
        </div>

        {uploadKind === "assignment" && (
          <div>
            <label className="text-xs font-medium">Course</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
              disabled={data.courses.length === 0}
            >
              {data.courses.length === 0 ? (
                <option value="">Upload a syllabus first to create a course</option>
              ) : (
                data.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code ?? course.course_id} · {course.name ?? course.course_name}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-5">
        <Button
          onClick={() => fileRef.current?.click()}
          loading={uploading}
          disabled={uploadKind === "assignment" && data.courses.length === 0}
        >
          <UploadCloud className="h-4 w-4" />
          {uploading ? "Uploading…" : "Choose files"}
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <p className="text-[11px] text-muted/80 mt-4">
        PDF, DOCX, JPG, PNG · up to 25 MB each
      </p>
    </div>
  );
}
