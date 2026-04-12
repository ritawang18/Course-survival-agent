"use client";

import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { ArrowUpRight, CalendarRange, RefreshCw } from "lucide-react";

export function WeeklyPulseSnapshotCard() {
  const { data, refreshDashboardWeeklyOverview, dashboardPulseLoading } = useAppStore();
  const overview = data.dashboardWeeklyOverview;
  const coursesWithPulse = data.courses
    .filter((course) => !!course.weeklyPulse)
    .sort((a, b) => {
      const aNeedsRefresh = a.weeklyPulse?.needsRefresh ? 1 : 0;
      const bNeedsRefresh = b.weeklyPulse?.needsRefresh ? 1 : 0;
      if (aNeedsRefresh !== bNeedsRefresh) return aNeedsRefresh - bNeedsRefresh;
      return (b.weeklyPulse?.pulse.confidence ?? 0) - (a.weeklyPulse?.pulse.confidence ?? 0);
    })
    .slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly pulse</CardTitle>
        <Button
          size="sm"
          variant="secondary"
          loading={dashboardPulseLoading}
          onClick={() => refreshDashboardWeeklyOverview()}
        >
          {!dashboardPulseLoading && <RefreshCw className="h-3.5 w-3.5" />}
          {dashboardPulseLoading ? "Refreshing…" : overview ? "Refresh overall" : "Generate overall"}
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        {overview ? (
          <div className="rounded-xl border border-border/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Overall semester view</span>
              <div className="flex-1" />
              <Badge variant="accent">{Math.round(overview.confidence * 100)}%</Badge>
            </div>
            <div className="text-[11px] text-muted">
              {new Date(overview.generatedAt).toLocaleString()}
            </div>
            <div className="space-y-2">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  Last Week
                </div>
                <p className="text-xs text-muted mt-1">{overview.pastWeekOverview}</p>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  Next Week
                </div>
                <p className="text-xs text-muted mt-1">{overview.nextWeekOverview}</p>
              </div>
            </div>
            {overview.courseHighlights.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                  Course Highlights
                </div>
                {overview.courseHighlights.map((item) => {
                  const course = data.courses.find((entry) => entry.id === item.courseId);
                  return (
                    <div key={`${item.courseId}-${item.label}`} className="text-xs text-muted">
                      <span className="font-medium text-text">
                        {course?.code ?? course?.course_id ?? item.courseId}
                      </span>
                      {": "}
                      {item.reason}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Generate from the dashboard to get an overall cross-course weekly overview. Generate inside a course page when you want a course-specific pulse.
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Course pulses
          </div>
          <Link
            href={coursesWithPulse[0] ? `/courses/${coursesWithPulse[0].id}` : "/courses"}
            className="text-xs text-accent hover:underline flex items-center gap-0.5"
          >
            Open course <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        {coursesWithPulse.length === 0 ? (
          <p className="text-sm text-muted">No course-specific pulse has been generated yet.</p>
        ) : (
          coursesWithPulse.map((course) => (
            <div key={course.id} className="rounded-xl border border-border/60 p-3">
              <div className="flex items-center gap-2">
                <CalendarRange className="h-3.5 w-3.5 text-accent" />
                <span className="text-sm font-medium">{course.code ?? course.course_id}</span>
                <div className="flex-1" />
                {course.weeklyPulse?.needsRefresh && <Badge variant="warning">Stale</Badge>}
                <Badge variant="muted">
                  {Math.round((course.weeklyPulse?.pulse.confidence ?? 0) * 100)}%
                </Badge>
              </div>
              <div className="text-[11px] text-muted mt-2">
                {course.weeklyPulse?.generatedAt
                  ? new Date(course.weeklyPulse.generatedAt).toLocaleString()
                  : "Not generated yet"}
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
