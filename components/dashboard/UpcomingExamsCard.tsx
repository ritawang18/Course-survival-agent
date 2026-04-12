"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import { differenceInCalendarDays, format } from "date-fns";

export function UpcomingExamsCard() {
  const { data } = useAppStore();
  const upcoming = [...data.exams]
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming exams</CardTitle>
        <Badge variant="muted">{upcoming.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {upcoming.map((e) => {
          const course = data.courses.find((c) => c.id === e.course_id);
          const days = differenceInCalendarDays(new Date(e.date), new Date());
          const urgent = days <= 7;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl flex flex-col items-center justify-center text-[10px] font-semibold",
                  course ? courseColorMap[course.color].softBg : "muted-surface",
                  course ? courseColorMap[course.color].text : ""
                )}
              >
                <span className="uppercase">{format(new Date(e.date), "MMM")}</span>
                <span className="text-base leading-none mt-0.5">
                  {format(new Date(e.date), "d")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.title}</div>
                <div className="text-[11px] text-muted">
                  {course?.code} · {e.location}
                </div>
              </div>
              <Badge variant={urgent ? "danger" : "muted"}>
                {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days}d`}
              </Badge>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
