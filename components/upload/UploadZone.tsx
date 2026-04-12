"use client";

import { useRef, useState } from "react";
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
  const { pushToast, addUpload } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File): Promise<UploadResponse> => {
    const kind: UploadKind = file.name.toLowerCase().includes("assignment")
      ? "assignment"
      : "syllabus";

    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);

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
    setUploading(true);
    const arr = Array.from(files);
    for (const file of arr) {
      try {
        const payload = await uploadFile(file);
        addUpload(buildArtifact(file, payload));
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
        We'll extract deadlines, grading weights, exam dates, and attendance
        policies automatically.
      </p>

      <div className="flex items-center gap-2 mt-5">
        <Button onClick={() => fileRef.current?.click()} loading={uploading}>
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
