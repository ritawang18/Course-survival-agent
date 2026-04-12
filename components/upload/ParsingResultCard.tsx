"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { UploadArtifact } from "@/lib/store/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FileText, Check, AlertTriangle, Loader2, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { getSupabaseClient } from "@/lib/supabase/client";

const kindLabel = {
  syllabus: "Syllabus",
  notes: "Lecture notes",
  assignment: "Assignment",
} as const;

export function ParsingResultCard({ artifact }: { artifact: UploadArtifact }) {
  const { updateUpload, refreshData, pushToast } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editedExtracted, setEditedExtracted] = useState(artifact.extracted);

  const needsReview = artifact.status === "needs_review";
  const parsing = artifact.status === "parsing";
  const confirmed = artifact.status === "confirmed";

  const handleEdit = () => {
    setEditing(true);
    setEditedExtracted({ ...artifact.extracted });
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditedExtracted(artifact.extracted);
  };

  const handleSaveEdit = () => {
    updateUpload(artifact.id, { extracted: editedExtracted });
    setEditing(false);
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: artifact.kind === "assignment" ? "assignment" : "syllabus",
          extracted: editing ? editedExtracted : artifact.extracted,
          courseId: artifact.courseId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Confirm failed" }));
        throw new Error(error);
      }

      updateUpload(artifact.id, { status: "confirmed" });
      setEditing(false);
      await refreshData().catch(() => {});
      pushToast({
        kind: "success",
        title: "Applied to course",
        description: `${artifact.fileName} data saved successfully.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Confirm failed",
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConfirming(false);
    }
  };

  const updateDeadline = (index: number, field: "label" | "date", value: string) => {
    setEditedExtracted((prev) => ({
      ...prev,
      deadlines: prev.deadlines.map((d, i) =>
        i === index ? { ...d, [field]: value } : d
      ),
    }));
  };

  const updateWeight = (index: number, field: "name" | "percent", value: string) => {
    setEditedExtracted((prev) => ({
      ...prev,
      weights: prev.weights.map((w, i) =>
        i === index
          ? { ...w, [field]: field === "percent" ? Number(value) || 0 : value }
          : w
      ),
    }));
  };

  const updateExamDate = (index: number, field: "label" | "date", value: string) => {
    setEditedExtracted((prev) => ({
      ...prev,
      examDates: prev.examDates.map((e, i) =>
        i === index ? { ...e, [field]: value } : e
      ),
    }));
  };

  return (
    <Card className={cn(needsReview && "ring-1 ring-warning/40 border-warning/30")}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl muted-surface flex items-center justify-center">
            <FileText className="h-5 w-5 text-muted" />
          </div>
          <div>
            <CardTitle>{artifact.fileName}</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              {kindLabel[artifact.kind]} ·{" "}
              {format(new Date(artifact.uploadedAt), "MMM d, h:mm a")}
            </p>
          </div>
        </div>
        {parsing ? (
          <Badge variant="accent">
            <Loader2 className="h-3 w-3 animate-spin" />
            Parsing
          </Badge>
        ) : confirmed ? (
          <Badge variant="success">
            <Check className="h-3 w-3" />
            Confirmed
          </Badge>
        ) : needsReview ? (
          <Badge variant="warning">
            <AlertTriangle className="h-3 w-3" />
            Needs review
          </Badge>
        ) : (
          <Badge variant="accent">Pending review</Badge>
        )}
      </CardHeader>
      {parsing ? (
        <CardBody>
          <div className="space-y-2">
            {[70, 50, 85, 40].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded-md bg-gradient-to-r from-[hsl(var(--surface-2))] via-[hsl(var(--accent-soft))] to-[hsl(var(--surface-2))] bg-[length:400px_100%] animate-shimmer"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted mt-4">
            Extracting deadlines, grading weights, and attendance policy…
          </p>
        </CardBody>
      ) : (
        <CardBody className="space-y-5">
          {(editing ? editedExtracted : artifact.extracted).deadlines.length > 0 && (
            <Section title="Deadlines">
              {(editing ? editedExtracted : artifact.extracted).deadlines.map((d, i) => (
                editing ? (
                  <EditableRow
                    key={i}
                    label={d.label}
                    value={d.date}
                    onLabelChange={(v) => updateDeadline(i, "label", v)}
                    onValueChange={(v) => updateDeadline(i, "date", v)}
                    confidence={d.confidence}
                  />
                ) : (
                  <Row
                    key={i}
                    label={d.label}
                    value={format(new Date(d.date), "MMM d, h:mm a")}
                    confidence={d.confidence}
                  />
                )
              ))}
            </Section>
          )}

          {(editing ? editedExtracted : artifact.extracted).weights.length > 0 && (
            <Section title="Grading weights">
              {(editing ? editedExtracted : artifact.extracted).weights.map((w, i) => (
                editing ? (
                  <EditableRow
                    key={i}
                    label={w.name}
                    value={String(w.percent)}
                    onLabelChange={(v) => updateWeight(i, "name", v)}
                    onValueChange={(v) => updateWeight(i, "percent", v)}
                    confidence={w.confidence}
                    valueSuffix="%"
                  />
                ) : (
                  <Row
                    key={i}
                    label={w.name}
                    value={`${w.percent}%`}
                    confidence={w.confidence}
                  />
                )
              ))}
            </Section>
          )}

          {(editing ? editedExtracted : artifact.extracted).examDates.length > 0 && (
            <Section title="Exam dates">
              {(editing ? editedExtracted : artifact.extracted).examDates.map((e, i) => (
                editing ? (
                  <EditableRow
                    key={i}
                    label={e.label}
                    value={e.date}
                    onLabelChange={(v) => updateExamDate(i, "label", v)}
                    onValueChange={(v) => updateExamDate(i, "date", v)}
                    confidence={e.confidence}
                  />
                ) : (
                  <Row
                    key={i}
                    label={e.label}
                    value={format(new Date(e.date), "MMM d, h:mm a")}
                    confidence={e.confidence}
                  />
                )
              ))}
            </Section>
          )}

          {(editing ? editedExtracted : artifact.extracted).attendancePolicy.text && (
            <Section title="Attendance policy">
              <div
                className={cn(
                  "rounded-xl muted-surface p-3 text-sm",
                  (editing ? editedExtracted : artifact.extracted).attendancePolicy.confidence < 0.75 &&
                    "ring-1 ring-warning/40 bg-warning/5"
                )}
              >
                <p>{(editing ? editedExtracted : artifact.extracted).attendancePolicy.text}</p>
                <div className="mt-2">
                  <ConfidenceBadge
                    value={(editing ? editedExtracted : artifact.extracted).attendancePolicy.confidence}
                  />
                </div>
              </div>
            </Section>
          )}

          {!confirmed && (
            <div className="flex items-center justify-end gap-2 pt-2">
              {editing ? (
                <>
                  <Button variant="secondary" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="h-3.5 w-3.5" />
                    Save edits
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={handleEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={handleConfirm} loading={confirming}>
                    <Check className="h-3.5 w-3.5" />
                    Apply to course
                  </Button>
                </>
              )}
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string;
  confidence: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 border border-border/60",
        confidence < 0.75 && "border-warning/40 bg-warning/5"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        <div className="text-[11px] text-muted font-mono">{value}</div>
      </div>
      <ConfidenceBadge value={confidence} />
    </div>
  );
}

function EditableRow({
  label,
  value,
  onLabelChange,
  onValueChange,
  confidence,
  valueSuffix,
}: {
  label: string;
  value: string;
  onLabelChange: (v: string) => void;
  onValueChange: (v: string) => void;
  confidence: number;
  valueSuffix?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2 border border-accent/40 bg-accent/5",
        confidence < 0.75 && "border-warning/40 bg-warning/5"
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="w-full text-sm font-medium bg-transparent border-b border-border/40 outline-none focus:border-accent/60 px-0 py-0.5"
        />
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="flex-1 text-[11px] text-muted font-mono bg-transparent border-b border-border/40 outline-none focus:border-accent/60 px-0 py-0.5"
          />
          {valueSuffix && <span className="text-[11px] text-muted">{valueSuffix}</span>}
        </div>
      </div>
      <ConfidenceBadge value={confidence} />
    </div>
  );
}
