"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { StatTile } from "@/components/dashboard/StatTile";
import { TodayPlanPanel } from "@/components/dashboard/TodayPlanPanel";
import { DeadlineList } from "@/components/deadlines/DeadlineList";
import { WeeklyWorkloadChart } from "@/components/dashboard/WeeklyWorkloadChart";
import { UpcomingExamsCard } from "@/components/dashboard/UpcomingExamsCard";
import { GradeSnapshotCard } from "@/components/dashboard/GradeSnapshotCard";
import { AttendanceWidget } from "@/components/attendance/AttendanceWidget";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { GraduationCap, AlertTriangle, Clock3, TrendingUp } from "lucide-react";
import { gpa } from "@/lib/utils/grade";
import { differenceInCalendarDays } from "date-fns";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data } = useAppStore();

  const avgGrade =
    data.courses.reduce((sum, c) => sum + (c.current_grade_percent ?? 0), 0) /
    data.courses.length;
  const avgGpa = gpa(avgGrade);

  const upcoming = data.assignments.filter(
    (a) =>
      a.status !== "done" &&
      differenceInCalendarDays(new Date(a.dueDate), new Date()) <= 7
  ).length;

  const studyHours = data.studyBlocks
    .filter((b) => b.type === "study")
    .reduce((sum, b) => {
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      return sum + (eh + em / 60 - (sh + sm / 60));
    }, 0);

  const attendanceRisk = data.courses.filter(
    (c) => c.missedClasses >= c.attendancePolicy.maxAbsences - 1
  ).length;

  return (
    <div>
      <PageHeader
        eyebrow="Spring 2026 · Week 8"
        title={`${greeting()}, Marco`}
        description="Here's the state of your semester. You have a busy week coming up — let's make it count."
        actions={<QuickActionsBar />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile
          icon={GraduationCap}
          label="Current GPA"
          value={avgGpa.toFixed(2)}
          hint={`Avg ${avgGrade.toFixed(1)}%`}
          tone="accent"
        />
        <StatTile
          icon={Clock3}
          label="Due this week"
          value={upcoming}
          hint={`${data.assignments.filter((a) => a.status === "in_progress").length} in progress`}
          tone="warning"
        />
        <StatTile
          icon={TrendingUp}
          label="Study hours planned"
          value={`${studyHours.toFixed(0)}h`}
          hint="Across 7 days"
          tone="success"
        />
        <StatTile
          icon={AlertTriangle}
          label="Attendance risk"
          value={attendanceRisk}
          hint={attendanceRisk > 0 ? "Courses near threshold" : "All clear"}
          tone={attendanceRisk > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2 space-y-4 lg:space-y-5">
          <TodayPlanPanel />
          <WeeklyWorkloadChart />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            <UpcomingExamsCard />
            <GradeSnapshotCard />
          </div>
        </div>
        <div className="space-y-4 lg:space-y-5">
          <DeadlineList />
          <AttendanceWidget />
        </div>
      </div>
    </div>
  );
}
