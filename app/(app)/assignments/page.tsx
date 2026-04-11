"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import type { Assignment, AssignmentStatus, Priority } from "@/lib/store/types";
import { relativeDue } from "@/lib/utils/date";

function priorityFromScore(score: number | undefined): Priority {
  if (score == null) return "optional";
  if (score >= 70) return "urgent";
  if (score >= 40) return "important";
  return "optional";
}
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import {
  ListChecks,
  Clock,
  GitBranch,
  CheckCircle2,
  Plus,
} from "lucide-react";

type Filter = "all" | AssignmentStatus;

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_started", label: "Not started" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
  { key: "overdue", label: "Overdue" },
];

const statusMap: Record<AssignmentStatus, { label: string; variant: "muted" | "accent" | "success" | "danger" }> = {
  not_started: { label: "Not started", variant: "muted" },
  in_progress: { label: "In progress", variant: "accent" },
  done: { label: "Done", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
};

export default function AssignmentsPage() {
  const { data, setAssignmentStatus } = useAppStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: data.assignments.length,
      not_started: 0,
      in_progress: 0,
      done: 0,
      overdue: 0,
    };
    for (const a of data.assignments) c[a.status]++;
    return c;
  }, [data.assignments]);

  const filtered = useMemo(() => {
    const arr =
      filter === "all"
        ? data.assignments
        : data.assignments.filter((a) => a.status === filter);
    return [...arr]
      .filter((a) => !!a.due_at)
      .sort(
        (a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()
      );
  }, [data.assignments, filter]);

  const openAssignment = data.assignments.find((a) => a.id === openId) ?? null;
  const openCourse = openAssignment
    ? data.courses.find((c) => c.id === openAssignment.course_id)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="Cross-course view"
        title="Assignments"
        description="Every task from every course, prioritized and dependency-aware."
        actions={
          <Button variant="primary">
            <Plus className="h-4 w-4" />
            New assignment
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "h-8 px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border transition-colors",
              filter === f.key
                ? "bg-accent text-white border-accent"
                : "bg-surface border-border hover:border-accent/40 text-text/80"
            )}
          >
            {f.label}
            <span
              className={cn(
                "text-[10px] font-mono px-1 rounded-full",
                filter === f.key
                  ? "bg-white/20 text-white"
                  : "muted-surface text-muted"
              )}
            >
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No assignments match this filter"
            description="Try selecting a different status or create a new assignment."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="muted-surface text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Title</th>
                <th className="text-left px-3 py-3 font-medium">Course</th>
                <th className="text-left px-3 py-3 font-medium">Due</th>
                <th className="text-left px-3 py-3 font-medium">Priority</th>
                <th className="text-left px-3 py-3 font-medium">Est.</th>
                <th className="text-left px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const course = data.courses.find((c) => c.id === a.course_id);
                const deps = a.dependencies ?? [];
                return (
                  <tr
                    key={a.id}
                    onClick={() => setOpenId(a.id)}
                    className="border-t border-border/60 hover:bg-[hsl(var(--surface-2))]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium">{a.title}</div>
                      {deps.length > 0 && (
                        <div className="flex items-center gap-1 text-[11px] text-muted mt-1">
                          <GitBranch className="h-3 w-3" />
                          Requires: {deps.join(", ")}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            course
                              ? courseColorMap[course.color].bg
                              : "bg-border"
                          )}
                        />
                        <span className="font-mono text-xs">{course?.code ?? course?.course_id}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted whitespace-nowrap">
                      {relativeDue(a.due_at!)}
                    </td>
                    <td className="px-3 py-3">
                      <PriorityBadge priority={priorityFromScore(a.importance_score)} />
                    </td>
                    <td className="px-3 py-3 text-muted font-mono text-xs">
                      {a.estimated_hours ?? 0}h
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={statusMap[a.status].variant}>
                        {statusMap[a.status].label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Drawer
        open={openAssignment != null}
        onClose={() => setOpenId(null)}
        title={openAssignment?.title}
        description={
          openCourse
            ? `${openCourse.code ?? openCourse.course_id} · ${openCourse.name ?? openCourse.course_name}`
            : undefined
        }
      >
        {openAssignment && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={priorityFromScore(openAssignment.importance_score)} />
              <Badge variant={statusMap[openAssignment.status].variant}>
                {statusMap[openAssignment.status].label}
              </Badge>
              <Badge variant="muted">
                <Clock className="h-3 w-3" />
                {openAssignment.estimated_hours ?? 0}h est.
              </Badge>
              {openAssignment.due_at && (
                <Badge variant="muted">Due {relativeDue(openAssignment.due_at)}</Badge>
              )}
            </div>

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-1">
                Description
              </div>
              <p className="text-sm leading-relaxed">{openAssignment.description}</p>
            </div>

            {(openAssignment.dependencies ?? []).length > 0 && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
                  Dependencies
                </div>
                <div className="space-y-1.5">
                  {(openAssignment.dependencies ?? []).map((d) => (
                    <div
                      key={d}
                      className="flex items-center gap-2 text-sm muted-surface rounded-lg px-3 py-2"
                    >
                      <GitBranch className="h-3.5 w-3.5 text-muted" />
                      {d}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
                Update status
              </div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(statusMap) as AssignmentStatus[]).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant={openAssignment.status === s ? "primary" : "secondary"}
                    onClick={() => setAssignmentStatus(openAssignment.id, s)}
                  >
                    {statusMap[s].label}
                  </Button>
                ))}
              </div>
            </div>

            {openAssignment.status !== "done" && (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setAssignmentStatus(openAssignment.id, "done");
                }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark as complete
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
