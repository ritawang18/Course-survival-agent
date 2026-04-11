import { GradeRing } from "@/components/common/GradeRing";
import { courseColorMap } from "@/components/common/CourseColor";
import type { Course } from "@/lib/store/types";
import { cn } from "@/lib/utils/cn";
import { MapPin, User, Clock, BookOpen } from "lucide-react";

export function CourseHeader({ course }: { course: Course }) {
  const colors = courseColorMap[course.color];
  return (
    <div className="card-surface overflow-hidden">
      <div className={cn("h-2 w-full bg-gradient-to-r", colors.stripe)} />
      <div className="p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
        <div className="flex gap-5">
          <GradeRing grade={course.currentGrade} size={72} stroke={6} label="current" />
          <div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-mono font-semibold px-2 py-0.5 rounded-md",
                  colors.softBg,
                  colors.text
                )}
              >
                {course.code}
              </span>
              <span className="text-xs text-muted">{course.credits} credits</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mt-1">
              {course.name}
            </h1>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted mt-2">
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> {course.instructor}
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {course.schedule}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> {course.room}
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> {course.modules.length} modules
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 md:gap-8">
          <Stat label="Current" value={`${course.currentGrade.toFixed(1)}%`} />
          <Stat
            label="Absences"
            value={`${course.missedClasses}/${course.attendancePolicy.maxAbsences}`}
          />
          <Stat label="Modules" value={`${course.modules.filter(m => m.status === "done").length}/${course.modules.length}`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
        {label}
      </div>
      <div className="text-xl font-semibold font-mono tracking-tight mt-0.5">
        {value}
      </div>
    </div>
  );
}
