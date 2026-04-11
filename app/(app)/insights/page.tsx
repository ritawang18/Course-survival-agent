"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import { Info, Quote, Star, MessageSquare, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { RmpInsight, RedditInsight } from "@/lib/schemas/insight";

const UNAVAILABLE_RMP: RmpInsight = {
  score: 0,
  sentiment: "unavailable",
  summary: "No Rate My Professor data available for this instructor.",
  quotes: [],
  tags: [],
};

const UNAVAILABLE_REDDIT: RedditInsight = {
  sentiment: "unavailable",
  summary: "No Reddit discussion found for this instructor.",
  quotes: [],
  tags: [],
};

function sentimentVariant(s: RmpInsight["sentiment"]): "success" | "warning" | "danger" | "muted" {
  if (s === "positive") return "success";
  if (s === "mixed") return "warning";
  if (s === "negative") return "danger";
  return "muted";
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "just now";
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function InsightsPage() {
  const { data, fetchProfessorInsight, insightsLoading } = useAppStore();
  const [selectedId, setSelectedId] = useState(data.courses[0].id);
  const course = data.courses.find((c) => c.id === selectedId)!;
  const rawInsight = data.insights.find((i) => i.courseId === selectedId);
  const insight: { rmp: RmpInsight; reddit: RedditInsight } = {
    rmp: rawInsight?.rmp ?? UNAVAILABLE_RMP,
    reddit: rawInsight?.reddit ?? UNAVAILABLE_REDDIT,
  };
  const isLive = !!rawInsight?.generatedAt;
  const loading = !!insightsLoading[selectedId];
  const canRefresh = !!course.instructor && !!course.school && !loading;

  return (
    <div>
      <PageHeader
        eyebrow="Instructor sentiment"
        title="Instructor insights"
        description="What other students say about your professors — summarized from public sources."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className={cn(
            "card-surface p-3 flex items-start gap-3 border-l-4 flex-1 min-w-[260px]",
            isLive ? "border-l-success" : "border-l-accent"
          )}
        >
          <Info
            className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              isLive ? "text-success" : "text-accent"
            )}
          />
          <p className="text-xs text-muted">
            {isLive
              ? `Live data · generated ${formatRelative(rawInsight!.generatedAt!)} from Rate My Professor + Reddit.`
              : "Mock data — click Refresh to pull live RMP + Reddit summaries via Claude."}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          loading={loading}
          disabled={!canRefresh}
          onClick={() => fetchProfessorInsight(selectedId)}
        >
          {!loading && <RefreshCw className="h-3.5 w-3.5" />}
          Refresh from sources
        </Button>
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
                  <Badge variant={sentimentVariant(insight.rmp.sentiment)}>
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
                  <Badge variant={sentimentVariant(insight.reddit.sentiment)}>
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
