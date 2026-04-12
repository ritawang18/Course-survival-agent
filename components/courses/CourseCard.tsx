"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { GradeRing } from "@/components/common/GradeRing";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import type { Course } from "@/lib/store/types";
import { relativeDue } from "@/lib/utils/date";
import { CalendarDays, AlertTriangle, ArrowUpRight } from "lucide-react";

export function CourseCard({ course }: { course: Course }) {
  const { data } = useAppStore();
  const nextDeadline = [...data.assignments]
    .filter((a) => a.course_id === course.id && a.status !== "done" && !!a.due_at)
    .sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime())[0];
  const nextExam = [...data.exams]
    .filter((e) => e.course_id === course.id && new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const colors = courseColorMap[course.color];
  const hasPolicy = course.attendance_allowed_misses > 0;
  const over = hasPolicy && course.attendance_missed_count >= course.attendance_allowed_misses;
  const near = hasPolicy &&
    course.attendance_missed_count >= course.attendance_allowed_misses - 1 && !over;

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group card-surface hover:shadow-card-hover transition-all block overflow-hidden"
    >
      <div className={cn("h-1.5 w-full bg-gradient-to-r", colors.stripe)} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded-md",
                  colors.softBg,
                  colors.text
                )}
              >
                {course.code}
              </span>
              <span className="text-[11px] text-muted">{course.credits} cr</span>
            </div>
            <h3 className="text-base font-semibold tracking-tight mt-1.5 truncate">
              {course.name}
            </h3>
            <p className="text-xs text-muted mt-0.5 truncate">
              {course.instructor}
            </p>
          </div>
          <GradeRing grade={course.current_grade_percent ?? 0} size={52} stroke={5} />
        </div>

        <div className="h-px bg-border/60 my-4" />

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="text-muted truncate">{course.schedule}</span>
          </div>
          {nextDeadline && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <span className="truncate">
                Next due: <span className="font-medium">{nextDeadline.title}</span>
              </span>
              <span className="text-muted ml-auto shrink-0">
                {relativeDue(nextDeadline.due_at!)}
              </span>
            </div>
          )}
          {nextExam && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-warning shrink-0" />
              <span className="truncate">
                {nextExam.title}
              </span>
              <span className="text-muted ml-auto shrink-0">
                {relativeDue(nextExam.date)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4">
          {course.attendance_allowed_misses > 0 ? (
            <>
              <Badge
                variant={over ? "danger" : near ? "warning" : "muted"}
                className="font-mono"
              >
                {course.attendance_missed_count}/{course.attendance_allowed_misses} absences
              </Badge>
              {near && (
                <Badge variant="warning">
                  <AlertTriangle className="h-3 w-3" />
                  Near threshold
                </Badge>
              )}
            </>
          ) : course.attendance_missed_count > 0 ? (
            <Badge variant="muted" className="font-mono">
              {course.attendance_missed_count} missed
            </Badge>
          ) : null}
          <div className="flex-1" />
          <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}
