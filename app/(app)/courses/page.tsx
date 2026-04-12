"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { CourseCard } from "@/components/courses/CourseCard";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { Button } from "@/components/ui/Button";
import { Grid2x2, Rows3, Plus } from "lucide-react";
import { useState } from "react";
import { GradeRing } from "@/components/common/GradeRing";
import { courseColorMap } from "@/components/common/CourseColor";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export default function CoursesPage() {
  const { data } = useAppStore();
  const [view, setView] = useState<"grid" | "list">("grid");
  const avgGrade =
    data.courses.length > 0
      ? data.courses.reduce((sum, course) => sum + (course.current_grade_percent ?? 0), 0) /
        data.courses.length
      : 0;

  return (
    <div>
      <PageHeader
        eyebrow={`${data.courses.length} courses`}
        title="Your courses"
        description={
          data.courses.length > 0
            ? `Average grade ${avgGrade.toFixed(1)}% across your current course set.`
            : "Upload a syllabus or ingest course data to start building your course workspace."
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 muted-surface rounded-xl">
              <button
                onClick={() => setView("grid")}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                  view === "grid" ? "bg-surface shadow-sm text-text" : "text-muted"
                )}
              >
                <Grid2x2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("list")}
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                  view === "list" ? "bg-surface shadow-sm text-text" : "text-muted"
                )}
              >
                <Rows3 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Button size="md" variant="primary">
              <Plus className="h-4 w-4" />
              Add course
            </Button>
          </div>
        }
      />

      {data.courses.length === 0 && (
        <div className="card-surface p-5 mb-4 text-sm text-muted">
          No courses found yet. Use the upload flow to create courses from a syllabus, then this page will fill in automatically.
        </div>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.courses.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="muted-surface text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Course</th>
                <th className="text-left px-3 py-3 font-medium">Instructor</th>
                <th className="text-left px-3 py-3 font-medium">Schedule</th>
                <th className="text-right px-3 py-3 font-medium">Grade</th>
                <th className="text-right px-5 py-3 font-medium">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {data.courses.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-border/60 hover:bg-[hsl(var(--surface-2))]/50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <Link href={`/courses/${c.id}`} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "h-8 w-1 rounded-full",
                          courseColorMap[c.color].bg
                        )}
                      />
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-[11px] text-muted font-mono">
                          {c.code}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted">{c.instructor}</td>
                  <td className="px-3 py-3 text-muted">{c.schedule}</td>
                  <td className="px-3 py-3 text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <span className="font-mono font-semibold">
                        {(c.current_grade_percent ?? 0).toFixed(1)}%
                      </span>
                      <GradeRing grade={c.current_grade_percent ?? 0} size={32} stroke={3} />
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs text-muted">
                    {c.attendance_missed_count}/{c.attendance_allowed_misses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
