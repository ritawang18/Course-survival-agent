"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { ArrowUpRight, CalendarRange } from "lucide-react";

export function WeeklyPulseSnapshotCard() {
  const { data } = useAppStore();
  const coursesWithPulse = data.courses
    .filter((course) => !!course.weeklyPulse)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly pulse</CardTitle>
        <Link
          href={coursesWithPulse[0] ? `/courses/${coursesWithPulse[0].id}` : "/courses"}
          className="text-xs text-accent hover:underline flex items-center gap-0.5"
        >
          Open course <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardBody className="space-y-3">
        {coursesWithPulse.length === 0 ? (
          <p className="text-sm text-muted">
            No weekly pulse has been generated yet. Open a course and generate one to see last-week learning and next-week focus.
          </p>
        ) : (
          coursesWithPulse.map((course) => (
            <div key={course.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-3.5 w-3.5 text-accent" />
                <span className="text-sm font-medium">
                  {course.code ?? course.course_id}
                </span>
                <div className="flex-1" />
                <Badge variant="muted">
                  {Math.round((course.weeklyPulse?.pulse.confidence ?? 0) * 100)}%
                </Badge>
              </div>
              <p className="text-xs text-muted mt-2 line-clamp-3">
                {course.weeklyPulse?.pulse.nextWeekPreview}
              </p>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
