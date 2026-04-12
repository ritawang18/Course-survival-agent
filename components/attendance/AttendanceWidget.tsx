"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { AlertTriangle, Check, Undo2, X } from "lucide-react";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";

function AttendancePie({
  attended,
  missed,
  size = 80,
  stroke = 10,
}: {
  attended: number;
  missed: number;
  size?: number;
  stroke?: number;
}) {
  const total = attended + missed;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const missedPct = total > 0 ? missed / total : 0;
  const attendedPct = total > 0 ? attended / total : 1;
  const missedOffset = circumference * (1 - missedPct);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Attended arc (background — full circle) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-success/70"
          fill="transparent"
        />
        {/* Missed arc (overlaid on top) */}
        {missed > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={missedOffset}
            className="stroke-danger/80 transition-[stroke-dashoffset] duration-500"
            fill="transparent"
          />
        )}
        {/* Empty state */}
        {total === 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={stroke}
            className="stroke-[hsl(var(--surface-2))]"
            fill="transparent"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-sm font-semibold">
          {total > 0 ? `${Math.round(attendedPct * 100)}%` : "—"}
        </span>
        {total > 0 && (
          <span className="text-[9px] text-muted mt-0.5">present</span>
        )}
      </div>
    </div>
  );
}

export function AttendanceWidget({ courseId }: { courseId?: string }) {
  const { data, markAttendance, undoAttendance } = useAppStore();
  // Track per-course whether user already clicked this page visit
  const [recorded, setRecorded] = useState<Record<string, "attended" | "missed">>({});
  const courses = courseId
    ? (data.courses ?? []).filter((c) => c.id === courseId)
    : (data.courses ?? []);

  if (courses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Attendance</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-muted">No courses loaded yet.</p>
        </CardBody>
      </Card>
    );
  }

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
      <CardBody className="space-y-5">
        {courses.map((c) => {
          const missed = c.attendance_missed_count;
          const max = c.attendance_allowed_misses;
          const hasPolicy = max > 0;
          const near = hasPolicy && missed >= max - 1 && missed < max;
          const over = hasPolicy && missed >= max;
          const pct = hasPolicy ? Math.min(100, (missed / max) * 100) : 0;

          const attended = c.attendance_attended_count;
          const remaining = hasPolicy ? max - missed : null;

          return (
            <div key={c.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    courseColorMap[c.color].bg
                  )}
                />
                <span className="text-sm font-medium truncate">{c.code}</span>
                <div className="flex-1" />
                {hasPolicy ? (
                  <Badge
                    variant={over ? "danger" : near ? "warning" : "muted"}
                    className="font-mono"
                  >
                    {missed}/{max} absences
                  </Badge>
                ) : (
                  <Badge variant="muted" className="font-mono">
                    {missed} missed
                  </Badge>
                )}
              </div>

              {/* Pie chart + stats row */}
              <div className="flex items-center gap-4">
                <AttendancePie
                  attended={attended}
                  missed={missed}
                  size={72}
                  stroke={9}
                />
                <div className="flex-1 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-success/70" />
                      Attended
                    </span>
                    <span className="font-mono font-medium">{attended}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-danger/80" />
                      Missed
                    </span>
                    <span className="font-mono font-medium">{missed}</span>
                  </div>
                  {hasPolicy && remaining !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Remaining skips</span>
                      <span
                        className={cn(
                          "font-mono font-medium",
                          remaining <= 0
                            ? "text-danger"
                            : remaining <= 1
                            ? "text-warning"
                            : "text-success"
                        )}
                      >
                        {Math.max(0, remaining)}
                      </span>
                    </div>
                  )}
                  {hasPolicy && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Suggested max misses</span>
                      <span className="font-mono font-medium">{max}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              {hasPolicy && (
                <div className="h-1.5 rounded-full bg-[hsl(var(--surface-2))] overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      over ? "bg-danger" : near ? "bg-warning" : "bg-success"
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}

              {!hasPolicy && (
                <p className="text-[11px] text-muted">
                  No attendance policy parsed. Absences are still tracked.
                </p>
              )}

              {near && !over && (
                <div className="flex items-start gap-2 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    {c.attendancePolicy?.penaltyPerAbsence
                      ? `One more absence triggers a ${c.attendancePolicy.penaltyPerAbsence}% grade penalty.`
                      : "One more absence reaches the allowed limit."}
                  </span>
                </div>
              )}

              {over && (
                <div className="flex items-start gap-2 text-[11px] text-danger">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>
                    {c.attendancePolicy?.penaltyPerAbsence
                      ? `Exceeded allowed absences — ${c.attendancePolicy.penaltyPerAbsence}% grade penalty per absence.`
                      : "Exceeded allowed absences."}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                {recorded[c.id] ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      undoAttendance(c.id, recorded[c.id]);
                      setRecorded((prev) => {
                        const next = { ...prev };
                        delete next[c.id];
                        return next;
                      });
                    }}
                  >
                    <Undo2 className="h-3 w-3" />
                    Undo {recorded[c.id] === "attended" ? "present" : "absence"}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        markAttendance(c.id, true);
                        setRecorded((prev) => ({ ...prev, [c.id]: "attended" }));
                      }}
                    >
                      <Check className="h-3 w-3" />
                      I went today
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        markAttendance(c.id, false);
                        setRecorded((prev) => ({ ...prev, [c.id]: "missed" }));
                      }}
                    >
                      <X className="h-3 w-3" />
                      Missed
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
