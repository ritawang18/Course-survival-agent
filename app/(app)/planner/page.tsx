"use client";

import { useState, useMemo } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { weekDays, isoDay, isSameDay, shortDay, format } from "@/lib/utils/date";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CalendarClock,
  Flame,
  GraduationCap,
} from "lucide-react";

const diffStyle = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-danger",
} as const;

const priorityStyle = {
  urgent: "border-l-danger bg-danger/5",
  important: "border-l-warning bg-warning/5",
  optional: "border-l-slate-300/60 bg-[hsl(var(--surface-2))]/40",
} as const;

export default function PlannerPage() {
  const { data, replanStudy, replanning } = useAppStore();
  const [anchor] = useState(new Date());
  const days = useMemo(() => weekDays(anchor), [anchor]);
  const studyBlocks = data.studyBlocks;
  const [selectedDay, setSelectedDay] = useState<string>(
    isoDay(new Date()).slice(0, 10)
  );

  const byDay = useMemo(() => {
    const map: Record<string, typeof studyBlocks> = {};
    for (const d of days) {
      map[isoDay(d).slice(0, 10)] = [];
    }
    for (const b of studyBlocks) {
      const key = b.date.slice(0, 10);
      if (key in map) map[key].push(b);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.start.localeCompare(b.start))
    );
    return map;
  }, [days, studyBlocks]);

  const nearestExam = [...data.exams]
    .filter((e) => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  const dayBlocks = byDay[selectedDay] ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Week view"
        title="Study planner"
        description="Dynamically generated based on deadlines, difficulty, and your current progress."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center border border-border rounded-xl bg-surface">
              <button className="h-9 w-9 flex items-center justify-center hover:bg-[hsl(var(--surface-2))] rounded-l-xl">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium px-3">
                {format(days[0], "MMM d")} – {format(days[6], "MMM d")}
              </span>
              <button className="h-9 w-9 flex items-center justify-center hover:bg-[hsl(var(--surface-2))] rounded-r-xl">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="primary"
              loading={replanning}
              onClick={() => replanStudy()}
            >
              <Sparkles className="h-4 w-4" />
              {replanning ? "Replanning…" : "Replan week"}
            </Button>
          </div>
        }
      />

      {nearestExam && (
        <div className="card-surface p-4 mb-5 flex items-start gap-3 border-l-4 border-l-warning">
          <div className="h-8 w-8 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
            <GraduationCap className="h-4 w-4 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">
              Exam constraint: {nearestExam.title}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {data.courses.find((c) => c.id === nearestExam.course_id)?.code} · Blocks
              8 hours of review this week for top priority topics.
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-danger" /> Urgent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warning" /> Important
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-400/60" /> Optional
        </span>
      </div>

      <Tabs defaultValue="week">
        <TabsList>
          <TabsTrigger value="week">Week view</TabsTrigger>
          <TabsTrigger value="day">Day view</TabsTrigger>
        </TabsList>

        <TabsContent value="week" className="mt-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {days.map((d) => {
              const key = isoDay(d).slice(0, 10);
              const blocks = byDay[key] ?? [];
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(key)}
                  className={cn(
                    "card-surface p-3 text-left space-y-2 hover:shadow-card-hover transition-all",
                    selectedDay === key && "ring-accent-soft border-accent/40",
                    isToday && "bg-[hsl(var(--accent-soft))]/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                        {shortDay(d)}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          isToday && "text-accent"
                        )}
                      >
                        {format(d, "d")}
                      </div>
                    </div>
                    {blocks.filter((b) => b.conflict).length > 0 && (
                      <span className="h-2 w-2 rounded-full bg-danger animate-pulse" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {blocks
                      .filter((b) => b.type === "study" && b.priority)
                      .slice(0, 4)
                      .map((b) => {
                        const course = data.courses.find(
                          (c) => c.id === b.course_id
                        );
                        return (
                          <div
                            key={b.id}
                            className={cn(
                              "rounded-md p-1.5 border-l-2 text-[11px] leading-tight",
                              priorityStyle[b.priority!]
                            )}
                          >
                            <div className="font-medium truncate">{b.title}</div>
                            <div className="text-muted flex items-center gap-1 mt-0.5 font-mono">
                              {b.start}
                              {b.difficulty && (
                                <span className={cn("ml-1", diffStyle[b.difficulty])}>
                                  · {b.difficulty}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {blocks.filter((b) => b.type === "study").length === 0 && (
                      <div className="text-[11px] text-muted/60 italic py-2">
                        No study blocks
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="day" className="mt-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>
                  {format(new Date(selectedDay), "EEEE · MMM d")}
                </CardTitle>
                <p className="text-xs text-muted mt-1">
                  {dayBlocks.length} blocks scheduled
                </p>
              </div>
              <Badge variant="muted">
                <CalendarClock className="h-3 w-3" />
                {dayBlocks
                  .filter((b) => b.type === "study")
                  .reduce((h, b) => {
                    const [sh, sm] = b.start.split(":").map(Number);
                    const [eh, em] = b.end.split(":").map(Number);
                    return h + (eh + em / 60 - (sh + sm / 60));
                  }, 0)
                  .toFixed(1)}
                h study
              </Badge>
            </CardHeader>
            <CardBody className="space-y-2">
              {dayBlocks.map((b) => {
                const course = data.courses.find((c) => c.id === b.course_id);
                const colors = course ? courseColorMap[course.color] : null;
                return (
                  <div
                    key={b.id}
                    className={cn(
                      "flex items-stretch gap-3 p-3 rounded-xl border border-border/60",
                      b.conflict && "border-danger/40 bg-danger/5"
                    )}
                  >
                    <div className="w-16 font-mono text-xs text-muted shrink-0">
                      {b.start}
                    </div>
                    <div
                      className={cn(
                        "w-1 rounded-full shrink-0",
                        colors?.bg ?? "bg-border"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">
                          {b.title}
                        </span>
                        {b.priority === "urgent" && (
                          <Badge variant="danger">
                            <Flame className="h-3 w-3" />
                            Urgent
                          </Badge>
                        )}
                        {b.conflict && (
                          <Badge variant="danger">
                            <AlertTriangle className="h-3 w-3" />
                            Conflict
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted mt-0.5 font-mono">
                        {course?.code} · {b.start} – {b.end}
                        {b.difficulty && ` · ${b.difficulty}`}
                      </div>
                    </div>
                  </div>
                );
              })}
              {dayBlocks.length === 0 && (
                <p className="text-sm text-muted py-8 text-center">
                  Nothing scheduled for this day.
                </p>
              )}
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
