"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { AlertTriangle, Check, X } from "lucide-react";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";

export function AttendanceWidget({ courseId }: { courseId?: string }) {
  const { data, markAttendance } = useAppStore();
  const courses = courseId
    ? data.courses.filter((c) => c.id === courseId)
    : data.courses;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Attendance</CardTitle>
          <p className="text-xs text-muted mt-1">
            Track missed classes & avoid grade penalties
          </p>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {courses.map((c) => {
          const used = c.attendance_missed_count;
          const max = c.attendance_allowed_misses;
          const near = used >= max - 1 && used < max;
          const over = used >= max;
          return (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    courseColorMap[c.color].bg
                  )}
                />
                <span className="text-sm font-medium truncate">{c.code}</span>
                <div className="flex-1" />
                <Badge
                  variant={over ? "danger" : near ? "warning" : "muted"}
                  className="font-mono"
                >
                  {used}/{max} absences
                </Badge>
              </div>

              <div className="h-1.5 rounded-full bg-[hsl(var(--surface-2))] overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    over ? "bg-danger" : near ? "bg-warning" : "bg-success"
                  )}
                  style={{
                    width: `${Math.min(100, (used / max) * 100)}%`,
                  }}
                />
              </div>

              {near && !over && (
                <div className="flex items-start gap-2 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    One more absence triggers a {c.attendancePolicy?.penaltyPerAbsence ?? 0}% grade penalty.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => markAttendance(c.id, true)}
                >
                  <Check className="h-3 w-3" />
                  I went today
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => markAttendance(c.id, false)}
                >
                  <X className="h-3 w-3" />
                  Missed
                </Button>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
