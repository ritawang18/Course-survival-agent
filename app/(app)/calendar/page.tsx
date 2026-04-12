"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import { buildCalendarExportEvents } from "@/lib/calendar/export-events";
import { weekDays, isoDay, isSameDay, shortDay, format } from "@/lib/utils/date";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import {
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
} from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";

const typeDot = {
  study: "bg-accent",
  class: "bg-slate-400",
  exam: "bg-danger",
  office_hours: "bg-emerald-500",
  deadline: "bg-warning",
} as const;

export default function CalendarPage() {
  const { data, syncGoogleCalendar, syncing, pushToast } = useAppStore();
  const [cursor, setCursor] = useState(new Date());
  const [downloadingIcs, setDownloadingIcs] = useState(false);
  const studyBlocks = data.studyBlocks;

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  const weekDaysArr = useMemo(() => weekDays(cursor), [cursor]);
  const blocksByDay = useMemo(() => {
    const map: Record<string, typeof studyBlocks> = {};
    for (const b of studyBlocks) {
      const key = b.date.slice(0, 10);
      (map[key] ??= []).push(b);
    }
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.start.localeCompare(b.start))
    );
    return map;
  }, [studyBlocks]);

  // free slots: 08:00 - 22:00 minus existing blocks
  const freeSlots = useMemo(() => {
    return weekDaysArr.map((d) => {
      const key = isoDay(d).slice(0, 10);
      const blocks = blocksByDay[key] ?? [];
      const busy = blocks.map((b) => ({ s: toMin(b.start), e: toMin(b.end) }));
      busy.sort((a, b) => a.s - b.s);
      const merged: { s: number; e: number }[] = [];
      for (const b of busy) {
        const last = merged[merged.length - 1];
        if (last && b.s <= last.e) last.e = Math.max(last.e, b.e);
        else merged.push({ ...b });
      }
      const free: { start: string; end: string }[] = [];
      let cursorMin = 8 * 60;
      const endMin = 22 * 60;
      for (const b of merged) {
        if (b.s > cursorMin) free.push({ start: fmt(cursorMin), end: fmt(b.s) });
        cursorMin = Math.max(cursorMin, b.e);
      }
      if (cursorMin < endMin) free.push({ start: fmt(cursorMin), end: fmt(endMin) });
      return { date: d, slots: free.filter((s) => toMin(s.end) - toMin(s.start) >= 45) };
    });
  }, [blocksByDay, weekDaysArr]);

  const downloadIcs = async () => {
    setDownloadingIcs(true);
    try {
      const events = buildCalendarExportEvents(data);
      if (events.length === 0) {
        pushToast({
          kind: "info",
          title: "Nothing to export",
          description: "There are no upcoming study blocks or exams to include in the ICS file.",
        });
        return;
      }

      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("You must be signed in to export calendar data.");
      }

      const fileName = `course-survival-agent-${isoDay(new Date())}.ics`;
      const res = await fetch("/api/calendar/ics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          events,
          calendarName: "Course Survival Agent",
          fileName,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Failed to export ICS" }));
        throw new Error(error);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      pushToast({
        kind: "success",
        title: "ICS downloaded",
        description: `Saved ${events.length} calendar item${events.length === 1 ? "" : "s"} to an ICS file.`,
      });
    } catch (err) {
      pushToast({
        kind: "error",
        title: "ICS export failed",
        description: err instanceof Error ? err.message : "Unexpected error",
      });
    } finally {
      setDownloadingIcs(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Schedule"
        title="Calendar"
        description="Study blocks, classes, exams, and office hours in one view."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center border border-border rounded-xl bg-surface">
              <button
                onClick={() =>
                  setCursor((d) => {
                    const n = new Date(d);
                    n.setMonth(n.getMonth() - 1);
                    return n;
                  })
                }
                className="h-9 w-9 flex items-center justify-center hover:bg-[hsl(var(--surface-2))] rounded-l-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium px-3">
                {format(cursor, "MMMM yyyy")}
              </span>
              <button
                onClick={() =>
                  setCursor((d) => {
                    const n = new Date(d);
                    n.setMonth(n.getMonth() + 1);
                    return n;
                  })
                }
                className="h-9 w-9 flex items-center justify-center hover:bg-[hsl(var(--surface-2))] rounded-r-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button
              variant="secondary"
              loading={syncing}
              onClick={() => syncGoogleCalendar()}
            >
              <RefreshCw className="h-4 w-4" />
              {syncing ? "Syncing…" : "Sync with Google"}
            </Button>
            <Button
              variant="secondary"
              loading={downloadingIcs}
              onClick={() => downloadIcs()}
            >
              <Download className="h-4 w-4" />
              {downloadingIcs ? "Preparing…" : "Download .ics"}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 lg:gap-5">
        <div className="xl:col-span-3">
          <Tabs defaultValue="week">
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>

            <TabsContent value="week" className="mt-4">
              <Card>
                <CardBody className="p-0">
                  <div className="grid grid-cols-7 border-b border-border/60">
                    {weekDaysArr.map((d) => {
                      const isToday = isSameDay(d, new Date());
                      return (
                        <div
                          key={d.toISOString()}
                          className="px-2 py-3 text-center border-r border-border/60 last:border-r-0"
                        >
                          <div className="text-[10px] uppercase tracking-wider text-muted">
                            {shortDay(d)}
                          </div>
                          <div
                            className={cn(
                              "text-base font-semibold mt-0.5",
                              isToday && "text-accent"
                            )}
                          >
                            {format(d, "d")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-7 min-h-[540px]">
                    {weekDaysArr.map((d) => {
                      const key = isoDay(d).slice(0, 10);
                      const blocks = blocksByDay[key] ?? [];
                      return (
                        <div
                          key={key}
                          className="p-1.5 space-y-1 border-r border-border/60 last:border-r-0 muted-surface/30"
                        >
                          {blocks.map((b) => {
                            const course = data.courses.find(
                              (c) => c.id === b.course_id
                            );
                            const colors = course ? courseColorMap[course.color] : null;
                            return (
                              <div
                                key={b.id}
                                className={cn(
                                  "rounded-md p-1.5 text-[11px] leading-tight border-l-[3px]",
                                  colors?.softBg ?? "muted-surface",
                                  b.conflict && "ring-1 ring-danger/50"
                                )}
                                style={{
                                  borderLeftColor: course
                                    ? cssColor(course.color)
                                    : undefined,
                                }}
                              >
                                <div className="font-medium truncate">{b.title}</div>
                                <div className="text-muted font-mono flex items-center gap-1 mt-0.5">
                                  <span className={cn("h-1.5 w-1.5 rounded-full", typeDot[b.type])} />
                                  {b.start}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </TabsContent>

            <TabsContent value="month" className="mt-4">
              <Card>
                <CardBody className="p-0">
                  <div className="grid grid-cols-7 border-b border-border/60 text-[10px] uppercase tracking-wider text-muted">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                      <div key={d} className="px-2 py-2 text-center border-r border-border/60 last:border-r-0">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 auto-rows-[96px]">
                    {monthDays.map((d) => {
                      const key = isoDay(d).slice(0, 10);
                      const blocks = blocksByDay[key] ?? [];
                      const inMonth = isSameMonth(d, cursor);
                      const isToday = isSameDay(d, new Date());
                      return (
                        <div
                          key={d.toISOString()}
                          className={cn(
                            "p-1.5 border-r border-b border-border/60 last:border-r-0 overflow-hidden",
                            !inMonth && "muted-surface/40 text-muted/50"
                          )}
                        >
                          <div
                            className={cn(
                              "text-xs font-medium mb-1",
                              isToday && "text-accent"
                            )}
                          >
                            {format(d, "d")}
                          </div>
                          <div className="space-y-0.5">
                            {blocks.slice(0, 3).map((b) => {
                              const course = data.courses.find(
                                (c) => c.id === b.course_id
                              );
                              return (
                                <div
                                  key={b.id}
                                  className="text-[10px] truncate flex items-center gap-1"
                                >
                                  <span
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full shrink-0",
                                      course
                                        ? courseColorMap[course.color].bg
                                        : "bg-border"
                                    )}
                                  />
                                  <span className="truncate">{b.title}</span>
                                </div>
                              );
                            })}
                            {blocks.length > 3 && (
                              <div className="text-[10px] text-muted">
                                +{blocks.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Free time this week</CardTitle>
                <p className="text-xs text-muted mt-1">
                  Slots ≥ 45 minutes
                </p>
              </div>
              <Badge variant="muted">
                <CalendarClock className="h-3 w-3" />
                auto
              </Badge>
            </CardHeader>
            <CardBody className="space-y-3">
              {freeSlots.map((fs) => (
                <div key={fs.date.toISOString()}>
                  <div className="text-[10px] uppercase tracking-wider text-muted font-medium mb-1">
                    {format(fs.date, "EEE MMM d")}
                  </div>
                  {fs.slots.length === 0 ? (
                    <div className="text-xs text-muted italic">No free windows</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {fs.slots.map((s, i) => (
                        <span
                          key={i}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-md muted-surface"
                        >
                          {s.start}–{s.end}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event types</CardTitle>
            </CardHeader>
            <CardBody className="space-y-1.5 text-xs">
              {(
                [
                  ["study", "Study block"],
                  ["class", "Lecture"],
                  ["exam", "Exam"],
                  ["office_hours", "Office hours"],
                  ["deadline", "Deadline"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", typeDot[k])} />
                  <span>{label}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function fmt(min: number) {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function cssColor(color: string) {
  const map: Record<string, string> = {
    indigo: "#6366f1",
    emerald: "#10b981",
    amber: "#f59e0b",
    rose: "#f43f5e",
    sky: "#0ea5e9",
    violet: "#8b5cf6",
  };
  return map[color] ?? "#6366f1";
}
