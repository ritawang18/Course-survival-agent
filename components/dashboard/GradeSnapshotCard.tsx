"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { GradeRing } from "@/components/common/GradeRing";
import { courseColorMap } from "@/components/common/CourseColor";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function GradeSnapshotCard() {
  const { data } = useAppStore();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grade snapshot</CardTitle>
        <Link
          href="/grades"
          className="text-xs text-accent hover:underline flex items-center gap-0.5"
        >
          Open calculator <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardBody className="space-y-2">
        {data.courses.map((c) => {
          const grade = c.current_grade_percent ?? 0;
          const tone =
            grade >= 90
              ? "success"
              : grade >= 80
              ? "accent"
              : grade >= 70
              ? "warning"
              : "danger";
          return (
            <div
              key={c.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <GradeRing grade={grade} size={42} stroke={4} tone={tone} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      courseColorMap[c.color].bg
                    )}
                  />
                  <span className="text-sm font-medium truncate">{c.code ?? c.course_id}</span>
                </div>
                <div className="text-[11px] text-muted truncate">{c.name ?? c.course_name}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono font-semibold">
                  {grade.toFixed(1)}%
                </div>
                <div className="text-[10px] text-muted">{c.credits} cr</div>
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
