"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { relativeDue } from "@/lib/utils/date";
import { courseColorMap } from "@/components/common/CourseColor";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { cn } from "@/lib/utils/cn";
import { priorityFromDueDate } from "@/lib/utils/priority";
import { differenceInCalendarDays } from "date-fns";
import { Clock } from "lucide-react";

export function DeadlineList({ limit = 6 }: { limit?: number }) {
  const { data } = useAppStore();
  const upcoming = [...data.assignments]
    .filter((a) => a.status !== "done" && !!a.due_at)
    .sort(
      (a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime()
    )
    .slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Upcoming deadlines</CardTitle>
          <p className="text-xs text-muted mt-1">Sorted by due date</p>
        </div>
        <Badge variant="muted">
          <Clock className="h-3 w-3" />
          next {limit}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-1">
        {upcoming.map((a) => {
          const course = data.courses.find((c) => c.id === a.course_id);
          const days = differenceInCalendarDays(new Date(a.due_at!), new Date());
          const overdue = days < 0 || a.status === "overdue";
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <div
                className={cn(
                  "w-1 self-stretch rounded-full",
                  course ? courseColorMap[course.color].bg : "bg-border"
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{a.title}</span>
                  <PriorityBadge priority={priorityFromDueDate(a.due_at)} />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                  <span>{course?.code ?? course?.course_id}</span>
                  <span>·</span>
                  <span className={overdue ? "text-danger font-medium" : ""}>
                    {relativeDue(a.due_at!)}
                  </span>
                  <span>·</span>
                  <span>{a.estimated_hours ?? 0}h</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
