"use client";

import { useAppStore } from "@/lib/store/AppStoreProvider";
import { notFound, useParams } from "next/navigation";
import { CourseHeader } from "@/components/courses/CourseHeader";
import { GradingWeightsCard } from "@/components/courses/GradingWeightsCard";
import { LectureModulesList } from "@/components/courses/LectureModulesList";
import { FilesCard } from "@/components/courses/FilesCard";
import { AIInsightsCard } from "@/components/courses/AIInsightsCard";
import { OfficeHourQuestionsCard } from "@/components/courses/OfficeHourQuestionsCard";
import { MockExamCard } from "@/components/courses/MockExamCard";
import { DependencyGraphCard } from "@/components/courses/DependencyGraphCard";
import { AttendanceWidget } from "@/components/attendance/AttendanceWidget";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { relativeDue } from "@/lib/utils/date";
import { ArrowLeft, CalendarDays } from "lucide-react";
import Link from "next/link";

export default function CourseDetailPage() {
  const params = useParams<{ courseId: string }>();
  const { data } = useAppStore();
  const course = data.courses.find((c) => c.id === params.courseId);
  if (!course) return notFound();

  const courseAssignments = data.assignments.filter(
    (a) => a.courseId === course.id
  );
  const courseExams = data.exams.filter((e) => e.courseId === course.id);

  return (
    <div>
      <Link
        href="/courses"
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to courses
      </Link>

      <CourseHeader course={course} />

      <div className="mt-5">
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="exams">Exams</TabsTrigger>
            <TabsTrigger value="modules">Modules</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
              <div className="xl:col-span-2 space-y-4 lg:space-y-5">
                <AIInsightsCard course={course} />
                <GradingWeightsCard course={course} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                  <OfficeHourQuestionsCard course={course} />
                  <MockExamCard course={course} />
                </div>
                <DependencyGraphCard course={course} />
              </div>
              <div className="space-y-4 lg:space-y-5">
                <AttendanceWidget courseId={course.id} />
                <FilesCard course={course} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>Course assignments</CardTitle>
                <Badge variant="muted">{courseAssignments.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-1">
                {courseAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{a.title}</span>
                        <PriorityBadge priority={a.priority} />
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {relativeDue(a.dueDate)} · {a.estimatedHours}h est.
                      </div>
                    </div>
                    <Badge
                      variant={
                        a.status === "done"
                          ? "success"
                          : a.status === "overdue"
                          ? "danger"
                          : a.status === "in_progress"
                          ? "accent"
                          : "muted"
                      }
                    >
                      {a.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="exams" className="mt-5">
            <Card>
              <CardHeader>
                <CardTitle>Course exams</CardTitle>
                <Badge variant="muted">{courseExams.length}</Badge>
              </CardHeader>
              <CardBody className="space-y-2">
                {courseExams.map((e) => (
                  <div key={e.id} className="p-4 rounded-xl border border-border/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{e.title}</div>
                        <div className="text-[11px] text-muted mt-0.5 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {relativeDue(e.date)} · {e.location}
                        </div>
                      </div>
                      <Badge variant="accent">{e.weight}% of grade</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {e.topics.map((t) => (
                        <Badge key={t} variant="muted">{t}</Badge>
                      ))}
                    </div>
                  </div>
                ))}
                {courseExams.length === 0 && (
                  <p className="text-sm text-muted py-6 text-center">No exams scheduled.</p>
                )}
              </CardBody>
            </Card>
          </TabsContent>

          <TabsContent value="modules" className="mt-5">
            <LectureModulesList course={course} />
          </TabsContent>

          <TabsContent value="files" className="mt-5">
            <FilesCard course={course} />
          </TabsContent>

          <TabsContent value="insights" className="mt-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
              <AIInsightsCard course={course} />
              <OfficeHourQuestionsCard course={course} />
              <MockExamCard course={course} />
              <DependencyGraphCard course={course} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
