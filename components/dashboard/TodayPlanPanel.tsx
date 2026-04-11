"use client";

import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { cn } from "@/lib/utils/cn";
import { isoDay } from "@/lib/utils/date";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { courseColorMap } from "@/components/common/CourseColor";

const typeLabel = {
  study: "Study",
  class: "Class",
  exam: "Exam",
  office_hours: "Office hours",
  deadline: "Deadline",
} as const;

const diffStyle = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-danger",
} as const;

export function TodayPlanPanel() {
  const { data } = useAppStore();
  const today = isoDay(new Date());
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const blocks = useMemo(
    () =>
      data.studyBlocks
        .filter((b) => b.date.startsWith(today.slice(0, 10)))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [data.studyBlocks, today]
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Today's plan</CardTitle>
          <p className="text-xs text-muted mt-1">
            {blocks.length} blocks · {blocks.filter((b) => b.type === "study").length} study sessions
          </p>
        </div>
        <Badge variant="accent">Auto-generated</Badge>
      </CardHeader>
      <CardBody>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            Nothing scheduled today — enjoy the break.
          </p>
        ) : (
          <ul className="space-y-1">
            {blocks.map((b) => {
              const course = data.courses.find((c) => c.id === b.courseId);
              const colors = course ? courseColorMap[course.color] : null;
              const isChecked = checked[b.id];
              return (
                <li
                  key={b.id}
                  className={cn(
                    "group relative flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-[hsl(var(--surface-2))] transition-colors",
                    isChecked && "opacity-60"
                  )}
                >
                  <button
                    onClick={() =>
                      setChecked((prev) => ({ ...prev, [b.id]: !prev[b.id] }))
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {isChecked ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted group-hover:text-accent" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "w-1 self-stretch rounded-full",
                      colors?.bg ?? "bg-border"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isChecked && "line-through"
                        )}
                      >
                        {b.title}
                      </span>
                      {b.conflict && (
                        <Badge variant="danger">
                          <AlertCircle className="h-3 w-3" />
                          Conflict
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                      <span className="font-mono">{b.start} – {b.end}</span>
                      <span>·</span>
                      <span>{course?.code ?? "—"}</span>
                      <span>·</span>
                      <span>{typeLabel[b.type]}</span>
                      {b.difficulty && (
                        <>
                          <span>·</span>
                          <span className={diffStyle[b.difficulty]}>
                            {b.difficulty}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
