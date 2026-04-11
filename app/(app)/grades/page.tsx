"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { GradeRing } from "@/components/common/GradeRing";
import { courseColorMap } from "@/components/common/CourseColor";
import { cn } from "@/lib/utils/cn";
import { weightedGrade, projectedFinal, letter, gpa } from "@/lib/utils/grade";
import { RotateCcw, TrendingUp, AlertCircle } from "lucide-react";

export default function GradesPage() {
  const { data, updateGradeScore } = useAppStore();
  const [selectedId, setSelectedId] = useState<string>(data.courses[0].id);
  const [optimistic, setOptimistic] = useState(85);

  const selected = data.courses.find((c) => c.id === selectedId)!;

  const current = useMemo(
    () => weightedGrade(selected.gradingWeights),
    [selected.gradingWeights]
  );
  const projected = useMemo(
    () => projectedFinal(selected.gradingWeights, optimistic),
    [selected.gradingWeights, optimistic]
  );

  const missing = selected.gradingWeights.filter((g) => g.earned == null);

  return (
    <div>
      <PageHeader
        eyebrow="What-if scenarios"
        title="Grade calculator"
        description="See exactly how upcoming work will impact your final grade."
      />

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
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  courseColorMap[c.color].bg
                )}
              />
              <span className="font-mono text-[11px] font-semibold">
                {c.code}
              </span>
            </div>
            <div className="text-sm font-semibold mt-1 font-mono">
              {(c.current_grade_percent ?? 0).toFixed(1)}%
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2 space-y-4 lg:space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Grade breakdown — {selected.name}</CardTitle>
                <p className="text-xs text-muted mt-1">
                  Edit any score to see live projection
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // reset earned to original from seed — simplified: clear overrides
                  selected.gradingWeights.forEach((g) => {
                    updateGradeScore(selected.id, g.id, g.earned);
                  });
                }}
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </CardHeader>
            <CardBody className="space-y-4">
              {selected.gradingWeights.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{g.name}</span>
                        <Badge variant="muted">
                          {g.weight}% of grade
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        {g.earned != null
                          ? `Current score ${g.earned}%`
                          : "Not yet graded"}
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={g.earned ?? ""}
                        placeholder="—"
                        onChange={(e) => {
                          const v = e.target.value;
                          updateGradeScore(
                            selected.id,
                            g.id,
                            v === "" ? undefined : Math.max(0, Math.min(100, Number(v)))
                          );
                        }}
                        className="h-9 w-20 rounded-lg border border-border bg-surface px-2 text-sm text-right font-mono outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)]"
                      />
                    </div>
                  </div>
                  <div className="h-2 mt-2 rounded-full bg-[hsl(var(--surface-2))] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        (g.earned ?? 0) >= 90
                          ? "bg-success"
                          : (g.earned ?? 0) >= 80
                          ? "bg-accent"
                          : (g.earned ?? 0) >= 70
                          ? "bg-warning"
                          : g.earned != null
                          ? "bg-danger"
                          : "bg-border"
                      )}
                      style={{
                        width: `${g.earned ?? 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>

          {missing.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-xl bg-warning/10 flex items-center justify-center">
                    <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <div>
                    <CardTitle>Impact of missing work</CardTitle>
                    <p className="text-xs text-muted mt-0.5">
                      If you score 0% vs 85% on ungraded items
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {missing.map((g) => {
                  const withZero = weightedGrade([
                    ...selected.gradingWeights.filter((x) => x.id !== g.id).map((x) => x),
                    { ...g, earned: 0 },
                  ]);
                  const with85 = weightedGrade([
                    ...selected.gradingWeights.filter((x) => x.id !== g.id).map((x) => x),
                    { ...g, earned: 85 },
                  ]);
                  return (
                    <div
                      key={g.id}
                      className="p-3 rounded-xl border border-border/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{g.name}</span>
                        <Badge variant="muted">{g.weight}%</Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <div>
                          <div className="text-muted">Worst case (0%)</div>
                          <div className="font-mono font-semibold text-danger">
                            {withZero.toFixed(1)}%
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-muted">Target (85%)</div>
                          <div className="font-mono font-semibold text-success">
                            {with85.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-accent" />
                </div>
                <CardTitle>Projected final</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col items-center text-center py-4">
                <GradeRing grade={projected} size={120} stroke={8} />
                <div className="mt-3 font-mono text-2xl font-semibold">
                  {projected.toFixed(1)}%
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {letter(projected)} · {gpa(projected).toFixed(2)} GPA
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-border/60">
                <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-3">
                  Assumed score on ungraded work
                </div>
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span>0%</span>
                  <span className="text-accent font-semibold">{optimistic}%</span>
                  <span>100%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={optimistic}
                  onChange={(e) => setOptimistic(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-muted">Current (graded only)</span>
                  <span className="font-mono font-semibold">
                    {current.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semester snapshot</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              {data.courses.map((c) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full shrink-0",
                      courseColorMap[c.color].bg
                    )}
                  />
                  <span className="text-sm flex-1 truncate">{c.code}</span>
                  <span className="text-xs font-mono text-muted">
                    {letter(c.current_grade_percent ?? 0)}
                  </span>
                  <span className="font-mono text-sm font-semibold">
                    {(c.current_grade_percent ?? 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
