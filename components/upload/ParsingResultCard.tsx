"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { UploadArtifact } from "@/lib/store/types";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { FileText, Check, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";

const kindLabel = {
  syllabus: "Syllabus",
  notes: "Lecture notes",
  assignment: "Assignment",
} as const;

export function ParsingResultCard({ artifact }: { artifact: UploadArtifact }) {
  const needsReview = artifact.status === "needs_review";
  const parsing = artifact.status === "parsing";
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
        ) : needsReview ? (
          <Badge variant="warning">
            <AlertTriangle className="h-3 w-3" />
            Needs review
          </Badge>
        ) : (
          <Badge variant="success">
            <Check className="h-3 w-3" />
            Parsed
          </Badge>
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
          {artifact.extracted.deadlines.length > 0 && (
            <Section title="Deadlines">
              {artifact.extracted.deadlines.map((d, i) => (
                <Row
                  key={i}
                  label={d.label}
                  value={format(new Date(d.date), "MMM d, h:mm a")}
                  confidence={d.confidence}
                />
              ))}
            </Section>
          )}

          {artifact.extracted.weights.length > 0 && (
            <Section title="Grading weights">
              {artifact.extracted.weights.map((w, i) => (
                <Row
                  key={i}
                  label={w.name}
                  value={`${w.percent}%`}
                  confidence={w.confidence}
                />
              ))}
            </Section>
          )}

          {artifact.extracted.examDates.length > 0 && (
            <Section title="Exam dates">
              {artifact.extracted.examDates.map((e, i) => (
                <Row
                  key={i}
                  label={e.label}
                  value={format(new Date(e.date), "MMM d, h:mm a")}
                  confidence={e.confidence}
                />
              ))}
            </Section>
          )}

          {artifact.extracted.attendancePolicy.text && (
            <Section title="Attendance policy">
              <div
                className={cn(
                  "rounded-xl muted-surface p-3 text-sm",
                  artifact.extracted.attendancePolicy.confidence < 0.75 &&
                    "ring-1 ring-warning/40 bg-warning/5"
                )}
              >
                <p>{artifact.extracted.attendancePolicy.text}</p>
                <div className="mt-2">
                  <ConfidenceBadge
                    value={artifact.extracted.attendancePolicy.confidence}
                  />
                </div>
              </div>
            </Section>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm">
              Edit
            </Button>
            <Button size="sm">
              <Check className="h-3.5 w-3.5" />
              Apply to course
            </Button>
          </div>
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
