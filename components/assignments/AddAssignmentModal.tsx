"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { Paperclip, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

const ASSIGNMENT_TYPES = [
  { value: "homework", label: "Homework" },
  { value: "quiz",     label: "Quiz" },
  { value: "exam",     label: "Exam" },
  { value: "project",  label: "Project" },
  { value: "lab",      label: "Lab" },
  { value: "essay",    label: "Essay / Paper" },
];

export function AddAssignmentModal({ open, onClose, onCreated }: Props) {
  const { data } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [courseId, setCourseId]         = useState("");
  const [title, setTitle]               = useState("");
  const [dueAt, setDueAt]               = useState("");
  const [points, setPoints]             = useState("");
  const [assignmentType, setAssignmentType] = useState("homework");
  const [status, setStatus]             = useState("not_started");
  const [file, setFile]                 = useState<File | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [parsedNote, setParsedNote]     = useState<string | null>(null);

  function reset() {
    setCourseId(""); setTitle(""); setDueAt(""); setPoints("");
    setAssignmentType("homework"); setStatus("not_started"); setFile(null);
    setError(null); setParsedNote(null);
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (f && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setFile(f);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId)   { setError("Please select a course."); return; }
    if (!dueAt)      { setError("Due date is required."); return; }
    if (!points || isNaN(Number(points)) || Number(points) < 0) {
      setError("Total points must be a positive number.");
      return;
    }

    setLoading(true);
    setError(null);
    setParsedNote(null);

    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You must be signed in.");

      const form = new FormData();
      form.append("course_id",       courseId);
      // datetime-local gives a timezone-free string like "2025-12-15T23:59".
      // new Date(string) can parse that as UTC in some browsers, so we parse
      // the parts manually — the Date(y,m,d,h,min) constructor always uses local time.
      const [datePart, timePart] = dueAt.split("T");
      const [y, mo, d] = datePart.split("-").map(Number);
      const [h, mi]    = timePart.split(":").map(Number);
      form.append("due_at", new Date(y, mo - 1, d, h, mi).toISOString());
      form.append("points_possible", points);
      if (title.trim())              form.append("title", title.trim());
      form.append("assignment_type", assignmentType);
      form.append("status",          status);
      if (file)                      form.append("file", file);

      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create assignment.");

      if (json.parsedFromFile) {
        setParsedNote("PDF parsed — additional details (estimated hours, dependencies) extracted and saved.");
      }

      reset();
      onClose();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="New assignment">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">

        {/* Course — required */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Course <span className="text-accent">*</span>
          </label>
          <select
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setError(null); }}
            className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
          >
            <option value="">Select a course…</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_name ?? c.name ?? c.course_id}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Title
            <span className="ml-1 text-muted/60 normal-case font-normal">(auto-filled from PDF if blank)</span>
          </label>
          <Input
            placeholder="e.g. Homework 3: Trees and Recursion"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Due date + Points — side by side, both required */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Due date <span className="text-accent">*</span>
            </label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => { setDueAt(e.target.value); setError(null); }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Total points <span className="text-accent">*</span>
            </label>
            <Input
              type="number"
              min={0}
              step={0.5}
              placeholder="e.g. 100"
              value={points}
              onChange={(e) => { setPoints(e.target.value); setError(null); }}
            />
          </div>
        </div>

        {/* Type + Status — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Type
            </label>
            <select
              value={assignmentType}
              onChange={(e) => setAssignmentType(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
            >
              {ASSIGNMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
            >
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>

        {/* PDF upload — optional */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Assignment PDF
            <span className="ml-1 text-muted/60 normal-case font-normal">(optional — parser extracts extra details)</span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {file ? (
            <div className="flex items-center gap-2 h-9 px-3 rounded-xl border border-border bg-surface text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted shrink-0" />
              <span className="truncate flex-1 text-muted">{file.name}</span>
              <button
                type="button"
                onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-muted hover:text-text shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 h-9 px-3 w-full rounded-xl border border-dashed border-border bg-surface text-sm text-muted hover:border-accent/60 hover:text-text transition-colors"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              Attach PDF…
            </button>
          )}
        </div>

        {parsedNote && (
          <p className="text-xs text-accent">{parsedNote}</p>
        )}
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            {file ? "Upload & save" : "Save assignment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
