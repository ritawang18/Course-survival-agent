"use client";

import { useMemo } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { weekDays, shortDay, isoDay, isSameDay } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";
import { courseColorMap } from "@/components/common/CourseColor";

function hoursBetween(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh + em / 60 - (sh + sm / 60));
}

export function WeeklyWorkloadChart() {
  const { data } = useAppStore();
  const days = weekDays();

  const perDay = useMemo(() => {
    return days.map((d) => {
      const dayStr = isoDay(d).slice(0, 10);
      const blocks = data.studyBlocks.filter(
        (b) => b.date.slice(0, 10) === dayStr && b.type === "study"
      );
      const byCourse = new Map<string, number>();
      let total = 0;
      for (const b of blocks) {
        const h = hoursBetween(b.start, b.end);
        total += h;
        byCourse.set(b.courseId, (byCourse.get(b.courseId) ?? 0) + h);
      }
      return { date: d, total, byCourse: Array.from(byCourse.entries()) };
    });
  }, [days, data.studyBlocks]);

  const max = Math.max(6, ...perDay.map((p) => p.total));

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Weekly workload</CardTitle>
          <p className="text-xs text-muted mt-1">
            Study hours by day, segmented by course
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data.courses.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={cn("h-2 w-2 rounded-sm", courseColorMap[c.color].bg)} />
              {c.code}
            </div>
          ))}
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex items-end gap-3 h-40">
          {perDay.map((p) => (
            <div key={p.date.toISOString()} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex-1 w-full flex items-end justify-center">
                <div className="w-8 md:w-10 h-full flex flex-col-reverse rounded-lg overflow-hidden muted-surface">
                  {p.byCourse.map(([courseId, h]) => {
                    const c = data.courses.find((x) => x.id === courseId);
                    if (!c) return null;
                    const pct = (h / max) * 100;
                    return (
                      <div
                        key={courseId}
                        style={{ height: `${pct}%` }}
                        className={cn(
                          courseColorMap[c.color].bg,
                          "transition-all"
                        )}
                        title={`${c.code}: ${h.toFixed(1)}h`}
                      />
                    );
                  })}
                </div>
              </div>
              <div
                className={cn(
                  "text-[10px] font-medium",
                  isSameDay(p.date, new Date()) ? "text-accent" : "text-muted"
                )}
              >
                {shortDay(p.date)}
              </div>
              <div className="text-[10px] text-muted font-mono">
                {p.total.toFixed(1)}h
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
