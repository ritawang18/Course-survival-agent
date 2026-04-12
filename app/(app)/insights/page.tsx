"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Gauge, Info, MessageSquare, Quote, RefreshCw, Search, Star, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import type { RmpInsight, RedditInsight, Sentiment } from "@/lib/schemas/insight";

const UNAVAILABLE_RMP: RmpInsight = {
  score: 0,
  sentiment: "unavailable",
  summary: "No Rate My Professor data available for this instructor yet.",
  quotes: [],
  tags: [],
};

const UNAVAILABLE_REDDIT: RedditInsight = {
  sentiment: "unavailable",
  summary: "No Reddit discussion found for this instructor yet.",
  quotes: [],
  tags: [],
};

function sentimentVariant(
  s: Sentiment
): "success" | "warning" | "danger" | "muted" {
  if (s === "positive") return "success";
  if (s === "mixed") return "warning";
  if (s === "negative") return "danger";
  return "muted";
}

function formatRelative(iso?: string): string {
  if (!iso) return "just now";
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

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return `${Math.round(value)}%`;
}

function formatRating(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "N/A";
  return value.toFixed(1);
}

function EmptyCardBody({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

export default function InsightsPage() {
  const { data, fetchProfessorInsight, insightsLoading } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    data.courses[0]?.id ?? null
  );

  useEffect(() => {
    if (!data.courses.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !data.courses.some((course) => course.id === selectedId)) {
      setSelectedId(data.courses[0].id);
    }
  }, [data.courses, selectedId]);

  const course = data.courses.find((c) => c.id === selectedId) ?? null;
  const rawInsight =
    data.insights.find((insight) => insight.courseId === selectedId) ?? null;

  const rmp = rawInsight?.rmp ?? UNAVAILABLE_RMP;
  const reddit = rawInsight?.reddit ?? UNAVAILABLE_REDDIT;
  const rmpSource = rawInsight?.sources?.rmp ?? null;
  const redditSource = rawInsight?.sources?.reddit ?? null;
  const loading = selectedId ? !!insightsLoading[selectedId] : false;
  const canRefresh = !!course?.instructor && !!course?.school && !loading;

  const rmpThemes = useMemo(() => {
    const direct = rmp.tags.length > 0 ? rmp.tags : rmpSource?.tags ?? [];
    return direct.slice(0, 6);
  }, [rmp.tags, rmpSource?.tags]);

  const quoteList = useMemo(() => {
    if (rmp.quotes.length > 0) return rmp.quotes;
    return rmpSource?.recentComments?.slice(0, 4) ?? [];
  }, [rmp.quotes, rmpSource?.recentComments]);

  const redditPosts = useMemo(() => redditSource?.posts ?? [], [redditSource?.posts]);

  const topSubreddits = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of redditPosts) {
      if (!post.subreddit) continue;
      counts.set(post.subreddit, (counts.get(post.subreddit) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));
  }, [redditPosts]);

  if (!data.courses.length) {
    return (
      <div>
        <PageHeader
          eyebrow="Instructor sentiment"
          title="Instructor insights"
          description="What other students say about your professors — summarized from public sources."
        />

        <Card>
          <CardHeader>
            <CardTitle>No courses yet</CardTitle>
          </CardHeader>
          <CardBody>
            <EmptyCardBody text="Sign in and upload at least one course before loading instructor insights." />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!course || !selectedId) {
    return null;
  }

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
            rawInsight ? "border-l-success" : "border-l-accent"
          )}
        >
          <Info
            className={cn(
              "h-4 w-4 mt-0.5 shrink-0",
              rawInsight ? "text-success" : "text-accent"
            )}
          />
          <p className="text-xs text-muted">
            {rawInsight
              ? `Cached insight loaded · generated ${formatRelative(rawInsight.generatedAt)} from Rate My Professor + Reddit.`
              : "No cached insight yet. Click Refresh to fetch and summarize public source data for this instructor."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={loading}
            disabled={!canRefresh}
            onClick={() => fetchProfessorInsight(selectedId)}
            title={
              canRefresh
                ? "Refresh public source data"
                : "This course needs both instructor and school information before refreshing."
            }
          >
            {!loading && <RefreshCw className="h-3.5 w-3.5" />}
            Refresh from sources
          </Button>
          <Button
            size="sm"
            loading={loading}
            disabled={!canRefresh}
            onClick={() => fetchProfessorInsight(selectedId)}
            title="Force re-fetch and regenerate insights from scratch, ignoring any cached data"
          >
            {!loading && <Search className="h-3.5 w-3.5" />}
            Investigate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-5">
        {data.courses.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            className={cn(
              "p-3 rounded-xl border text-left transition-all",
              selectedId === item.id
                ? "border-accent bg-[hsl(var(--accent-soft))]/40 shadow-sm"
                : "border-border bg-surface hover:border-accent/40"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn("h-2 w-2 rounded-full", courseColorMap[item.color].bg)}
              />
              <span className="font-mono text-[11px] font-semibold">
                {item.code}
              </span>
            </div>
            <div className="text-xs text-muted mt-1 truncate">
              {item.instructor ?? "Unknown instructor"}
            </div>
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
                  <Badge variant={sentimentVariant(rmp.sentiment)}>
                    {rmp.sentiment}
                  </Badge>
                </CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed">{rmp.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {rmpThemes.length > 0 ? (
                      rmpThemes.map((tag) => (
                        <Badge key={tag} variant="muted">
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="muted">No theme tags yet</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Student quotes</CardTitle>
                  <Badge variant="muted">
                    <Quote className="h-3 w-3" />
                    excerpts
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-3">
                  {quoteList.length > 0 ? (
                    quoteList.map((quote, index) => (
                      <div
                        key={`${quote}-${index}`}
                        className="p-3 rounded-xl muted-surface border-l-4 border-l-accent/40"
                      >
                        <p className="text-sm italic text-text/90">
                          &ldquo;{quote}&rdquo;
                        </p>
                      </div>
                    ))
                  ) : (
                    <EmptyCardBody text="No quoted comments are cached for this instructor yet." />
                  )}
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
                      {rmp.score.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted mt-1">out of 5.0</div>
                    <div className="flex items-center gap-0.5 mt-3">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={cn(
                            "h-4 w-4",
                            index < Math.round(rmp.score)
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
                  <CardTitle>Evidence snapshot</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Ratings
                    </span>
                    <span className="font-medium">
                      {rmpSource?.numRatings ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted flex items-center gap-2">
                      <Star className="h-3.5 w-3.5" />
                      Would take again
                    </span>
                    <span className="font-medium">
                      {formatPercent(rmpSource?.wouldTakeAgain)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted flex items-center gap-2">
                      <Gauge className="h-3.5 w-3.5" />
                      Difficulty
                    </span>
                    <span className="font-medium">
                      {formatRating(rmpSource?.difficulty)}
                    </span>
                  </div>
                  {rmpSource?.profileUrl ? (
                    <a
                      href={rmpSource.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-medium text-accent hover:underline"
                    >
                      Open Rate My Professor profile
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top themes</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-wrap gap-1.5">
                  {rmpThemes.length > 0 ? (
                    rmpThemes.map((theme) => (
                      <Badge key={theme} variant="outline">
                        {theme}
                      </Badge>
                    ))
                  ) : (
                    <EmptyCardBody text="No theme tags are cached yet." />
                  )}
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
                        {redditSource?.totalSeen
                          ? `Synthesized from ${redditSource.totalSeen} matching Reddit posts.`
                          : "No raw Reddit post cache available yet."}
                      </p>
                    </div>
                  </div>
                  <Badge variant={sentimentVariant(reddit.sentiment)}>
                    {reddit.sentiment}
                  </Badge>
                </CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed">{reddit.summary}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {reddit.tags.length > 0 ? (
                      reddit.tags.map((tag) => (
                        <Badge key={tag} variant="muted">
                          #{tag.toLowerCase().replace(/\s+/g, "-")}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="muted">No Reddit tags yet</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top posts</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3">
                  {redditPosts.length > 0 ? (
                    redditPosts.slice(0, 5).map((post) => (
                      <div
                        key={post.permalink || post.url || post.title}
                        className="p-3 rounded-xl border border-border/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{post.title}</p>
                            {post.body ? (
                              <p className="text-xs text-muted mt-1 leading-relaxed">
                                {post.body.slice(0, 220)}
                                {post.body.length > 220 ? "..." : ""}
                              </p>
                            ) : null}
                          </div>
                          {post.permalink ? (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 text-accent"
                              aria-label="Open Reddit thread"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted">
                          <span>{post.subreddit ? `r/${post.subreddit}` : "Unknown subreddit"}</span>
                          <span>↑ {post.score}</span>
                          <span>{post.numComments} comments</span>
                        </div>
                      </div>
                    ))
                  ) : reddit.quotes.length > 0 ? (
                    reddit.quotes.map((quote, index) => (
                      <div
                        key={`${quote}-${index}`}
                        className="p-3 rounded-xl border border-border/60"
                      >
                        <p className="text-sm">&ldquo;{quote}&rdquo;</p>
                      </div>
                    ))
                  ) : (
                    <EmptyCardBody text="No Reddit post cache is available for this instructor yet." />
                  )}
                </CardBody>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Signal summary</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Matched posts
                    </span>
                    <span className="font-medium">
                      {redditSource?.totalSeen ?? "N/A"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {topSubreddits.length > 0 ? (
                      topSubreddits.map((item) => (
                        <Badge key={item.name} variant="outline">
                          r/{item.name} · {item.count}
                        </Badge>
                      ))
                    ) : (
                      <EmptyCardBody text="No subreddit breakdown is cached yet." />
                    )}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Common themes</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-wrap gap-1.5">
                  {reddit.tags.length > 0 ? (
                    reddit.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <EmptyCardBody text="No Reddit theme tags are cached yet." />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
