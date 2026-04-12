"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { getSupabaseClient } from "@/lib/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void>;  // refreshData from store
}

interface FormState {
  course_id: string;
  course_name: string;
  term: string;
  instructor_name: string;
  current_grade_percent: string;
  attendance_missed_count: string;
  attendance_allowed_misses: string;
  credits: string;
}

const empty: FormState = {
  course_id: "",
  course_name: "",
  term: "",
  instructor_name: "",
  current_grade_percent: "",
  attendance_missed_count: "",
  attendance_allowed_misses: "",
  credits: "",
};

export function AddCourseModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      setError(null);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.course_name.trim()) {
      setError("Course name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You must be signed in.");

      const body: Record<string, string | number> = {
        course_name: form.course_name.trim(),
      };
      if (form.course_id.trim())           body.course_id = form.course_id.trim();
      if (form.term.trim())                body.term = form.term.trim();
      if (form.instructor_name.trim())     body.instructor_name = form.instructor_name.trim();
      if (form.current_grade_percent !== "") {
        const v = parseFloat(form.current_grade_percent);
        if (isNaN(v) || v < 0 || v > 100) { setError("Grade must be between 0 and 100."); setLoading(false); return; }
        body.current_grade_percent = v;
      }
      if (form.attendance_missed_count !== "") {
        const v = parseInt(form.attendance_missed_count, 10);
        if (isNaN(v) || v < 0) { setError("Attendance missed count must be 0 or more."); setLoading(false); return; }
        body.attendance_missed_count = v;
      }
      if (form.attendance_allowed_misses !== "") {
        const v = parseInt(form.attendance_allowed_misses, 10);
        if (isNaN(v) || v < 0) { setError("Allowed absences must be 0 or more."); setLoading(false); return; }
        body.attendance_allowed_misses = v;
      }
      if (form.credits !== "") {
        const v = parseInt(form.credits, 10);
        if (isNaN(v) || v < 0) { setError("Credits must be 0 or more."); setLoading(false); return; }
        body.credits = v;
      }

      const res = await fetch("/api/courses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create course.");

      setForm(empty);
      onClose();
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setForm(empty);
    setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add course">
      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {/* Course name — required */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Course name <span className="text-accent">*</span>
          </label>
          <Input
            placeholder="e.g. Introduction to Computer Science"
            value={form.course_name}
            onChange={set("course_name")}
            autoFocus
          />
        </div>

        {/* Course ID */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted uppercase tracking-wide">
            Course ID
            <span className="ml-1 text-muted/60 normal-case font-normal">(e.g. CS 344)</span>
          </label>
          <Input
            placeholder="e.g. CS 344"
            value={form.course_id}
            onChange={set("course_id")}
          />
        </div>

        {/* Term + Instructor — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Term
            </label>
            <Input
              placeholder="e.g. Fall 2025"
              value={form.term}
              onChange={set("term")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Instructor
            </label>
            <Input
              placeholder="e.g. Prof. Smith"
              value={form.instructor_name}
              onChange={set("instructor_name")}
            />
          </div>
        </div>

        {/* Grade + Credits — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Current grade (%)
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              placeholder="e.g. 88.5"
              value={form.current_grade_percent}
              onChange={set("current_grade_percent")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Credits
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 3"
              value={form.credits}
              onChange={set("credits")}
            />
          </div>
        </div>

        {/* Attendance missed + allowed — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Classes missed so far
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 2"
              value={form.attendance_missed_count}
              onChange={set("attendance_missed_count")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted uppercase tracking-wide">
              Allowed absences
            </label>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 5"
              value={form.attendance_allowed_misses}
              onChange={set("attendance_allowed_misses")}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" size="md" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" loading={loading}>
            Add course
          </Button>
        </div>
      </form>
    </Modal>
  );
}
