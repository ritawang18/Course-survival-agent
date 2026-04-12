"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Course } from "@/lib/store/types";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { RefreshCw, CalendarRange, Database, PlugZap } from "lucide-react";

function formatGeneratedAt(value?: string) {
  if (!value) return "Not generated yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Generated";
  return parsed.toLocaleString();
}

export function WeeklyCoursePulseCard({ course }: { course: Course }) {
  const { refreshWeeklyCoursePulse, pulseLoading } = useAppStore();
  const pulse = course.weeklyPulse;
  const loading = !!pulseLoading[course.id];

  const sourceBadges = useMemo(() => {
    if (!pulse) return [];
    const items: Array<{ label: string; icon: typeof Database }> = [];
    if (pulse.sourceSummary.hasDatabaseContext) {
      items.push({ label: "Database", icon: Database });
    }
    if (pulse.sourceSummary.hasCanvasApiContext) {
      items.push({ label: "Canvas API", icon: PlugZap });
    }
    return items;
  }, [pulse]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
            <CalendarRange className="h-4 w-4 text-accent" />
          </div>
          <div>
            <CardTitle>Weekly course pulse</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              What you learned last week and what comes next
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={loading}
          onClick={() => refreshWeeklyCoursePulse(course.id)}
        >
          {!loading && <RefreshCw className="h-3.5 w-3.5" />}
          {loading ? "Refreshing…" : pulse ? "Refresh" : "Generate"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={pulse ? "accent" : "muted"}>
            {pulse ? `${Math.round(pulse.pulse.confidence * 100)}% confidence` : "No pulse yet"}
          </Badge>
          {pulse?.needsRefresh && <Badge variant="warning">Needs refresh</Badge>}
          {sourceBadges.map((item) => {
            const Icon = item.icon;
            return (
              <Badge key={item.label} variant="muted">
                <Icon className="h-3 w-3" />
                {item.label}
              </Badge>
            );
          })}
        </div>

        <div className="text-[11px] text-muted">
          {formatGeneratedAt(pulse?.generatedAt)}
          {pulse?.ageDays != null ? ` · ${pulse.ageDays.toFixed(1)} days old` : ""}
        </div>

        {pulse ? (
          <>
            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted">
                Last Week
              </div>
              <p className="text-sm leading-relaxed">{pulse.pulse.pastWeekLearned}</p>
              {pulse.pulse.pastWeekEvidence.length > 0 && (
                <div className="space-y-1">
                  {pulse.pulse.pastWeekEvidence.slice(0, 3).map((item, index) => (
                    <div key={`${item.label}-${index}`} className="text-xs text-muted">
                      {item.label}: {item.detail}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted">
                Next Week
              </div>
              <p className="text-sm leading-relaxed">{pulse.pulse.nextWeekPreview}</p>
              {pulse.pulse.nextWeekEvidence.length > 0 && (
                <div className="space-y-1">
                  {pulse.pulse.nextWeekEvidence.slice(0, 3).map((item, index) => (
                    <div key={`${item.label}-${index}`} className="text-xs text-muted">
                      {item.label}: {item.detail}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted">
                Sources Used
              </div>
              <div className="flex flex-wrap gap-1.5">
                {renderSourceFlag("Syllabus", pulse.sourceSummary.usedSyllabus)}
                {renderSourceFlag("Assignments", pulse.sourceSummary.usedAssignments)}
                {renderSourceFlag("Grades", pulse.sourceSummary.usedGrades)}
                {renderSourceFlag("Study plan", pulse.sourceSummary.usedStudyPlan)}
                {renderSourceFlag("Canvas assignments", pulse.sourceSummary.usedCanvasAssignments)}
                {renderSourceFlag("Canvas modules", pulse.sourceSummary.usedCanvasModules)}
              </div>
            </section>

            <details className="rounded-xl border border-border/60 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted">
                Debug context
              </summary>
              <div className="mt-3 space-y-3">
                <div className="text-[11px] text-muted">
                  This helps verify exactly which database and Canvas signals were available when the pulse was generated.
                </div>
                <pre className="overflow-auto rounded-lg bg-[hsl(var(--surface-2))] p-3 text-[11px] leading-relaxed text-muted">
                  {JSON.stringify(
                    {
                      generatedAt: pulse.generatedAt,
                      sourceSummary: pulse.sourceSummary,
                      rawContext: pulse.rawContext ?? null,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </details>
          </>
        ) : (
          <p className="text-sm text-muted">
            No weekly pulse has been generated for this course yet. Generate one to surface last-week learning and next-week focus areas in the Web UI.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function renderSourceFlag(label: string, active: boolean) {
  return (
    <Badge key={label} variant={active ? "accent" : "muted"}>
      {label}
    </Badge>
  );
}
