"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import { Info, Quote, Star, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";

export default function InsightsPage() {
  const { data } = useAppStore();
  const [selectedId, setSelectedId] = useState(data.courses[0].id);
  const course = data.courses.find((c) => c.id === selectedId)!;
  const insight = data.insights.find((i) => i.courseId === selectedId)!;

  return (
    <div>
      <PageHeader
        eyebrow="Instructor sentiment"
        title="Instructor insights"
        description="What other students say about your professors — summarized from public sources."
      />

      <div className="card-surface p-3 mb-5 flex items-start gap-3 border-l-4 border-l-accent">
        <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
        <p className="text-xs text-muted">
          Mock data — not connected to real Rate My Professor or Reddit APIs. Summaries are illustrative.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        {data.courses.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selectedId === c.id
                ? "border-accent bg-[hsl(var(--accent-soft))]/40 shadow-sm"
                : "border-border bg-surface hover:border-accent/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", courseColorMap[c.color].bg)} />
              <span className="font-mono text-[11px] font-semibold">{c.code}</span>
            </div>
            <div className="text-xs text-muted mt-1 truncate">{c.instructor}</div>
          </button>
        ))}
      </div>

      <Tabs defaultValue="rmp">
        <TabsList>
          <TabsTrigger value="rmp">Rate My Professor</TabsTrigger>
          <TabsTrigger value="reddit">Reddit</TabsTrigger>
        </TabsList>

        <TabsContent value="rmp" className="mt-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
            <div className="xl:col-span-2 space-y-4 lg:space-y-5">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Summary · {course.instructor}</CardTitle>
                    <p className="text-xs text-muted mt-0.5">
                      {course.code} · {course.name}
                    </p>
                  </div>
                  <Badge
                    variant={
                      insight.rmp.sentiment === "positive"
                        ? "success"
                        : insight.rmp.sentiment === "mixed"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {insight.rmp.sentiment}
                  </Badge>
                </CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed">{insight.rmp.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {insight.rmp.tags.map((t) => (
                      <Badge key={t} variant="muted">{t}</Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Student quotes</CardTitle>
                  <Badge variant="muted">
                    <Quote className="h-3 w-3" />
                    highlights
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-3">
                  {insight.rmp.quotes.map((q, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl muted-surface border-l-4 border-l-accent/40"
                    >
                      <p className="text-sm italic text-text/90">"{q}"</p>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overall rating</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className="flex flex-col items-center py-3">
                    <div className="text-5xl font-semibold font-mono tracking-tight">
                      {insight.rmp.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted mt-1">out of 5.0</div>
                    <div className="flex items-center gap-0.5 mt-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-4 w-4",
                            i < Math.round(insight.rmp.score)
                              ? "fill-warning text-warning"
                              : "text-border"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top themes</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-success" />
                    <span>Clear explanations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-success" />
                    <span>Fair grading</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ThumbsDown className="h-3.5 w-3.5 text-danger" />
                    <span>Heavy workload</span>
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="reddit" className="mt-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
            <div className="xl:col-span-2 space-y-4 lg:space-y-5">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
                      <MessageSquare className="h-3.5 w-3.5 text-accent" />
                    </div>
                    <div>
                      <CardTitle>Reddit discussion</CardTitle>
                      <p className="text-xs text-muted mt-0.5">
                        Synthesized from ~{Math.floor(Math.random() * 30 + 20)} threads
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      insight.reddit.sentiment === "positive"
                        ? "success"
                        : insight.reddit.sentiment === "mixed"
                        ? "warning"
                        : "danger"
                    }
                  >
                    {insight.reddit.sentiment}
                  </Badge>
                </CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed">{insight.reddit.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {insight.reddit.tags.map((t) => (
                      <Badge key={t} variant="muted">#{t.toLowerCase().replace(/\s+/g, "-")}</Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top posts</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {insight.reddit.quotes.map((q, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-border/60"
                    >
                      <p className="text-sm">"{q}"</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                        <span>r/berkeley</span>
                        <span>·</span>
                        <span>↑ {Math.floor(Math.random() * 200 + 20)}</span>
                        <span>·</span>
                        <span>{Math.floor(Math.random() * 40 + 5)} comments</span>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Study tips</CardTitle>
                </CardHeader>
                <CardBody className="text-xs text-muted leading-relaxed space-y-2">
                  <p>· Start major projects early — feedback cycles matter</p>
                  <p>· Go to office hours before deadlines, not after</p>
                  <p>· Use past exams if the course archive allows</p>
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
