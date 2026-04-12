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
import { RotateCcw, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase/client";

interface PolicyResult {
  gradingPolicy: string;
  projectedGrade: number;
  currentGrade: number | null;
}

export default function GradesPage() {
  const { data, updateGradeScore } = useAppStore();
  const [selectedId, setSelectedId] = useState<string>(data.courses[0]?.id ?? "");
  const [optimistic, setOptimistic] = useState(85);

  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError]     = useState<string | null>(null);
  const [policyResult, setPolicyResult]   = useState<PolicyResult | null>(null);

  const selected = data.courses.find((c) => c.id === selectedId) ?? data.courses[0];
  const selectedWeights = useMemo(
    () => selected?.gradingWeights ?? [],
    [selected]
  );

  const current = useMemo(
    () => weightedGrade(selectedWeights),
    [selectedWeights]
  );
  const projected = useMemo(
    () => projectedFinal(selectedWeights, optimistic),
    [selectedWeights, optimistic]
  );
  const missing = selectedWeights.filter((g) => g.earned == null);

  function handleSelectCourse(id: string) {
    setSelectedId(id);
    setPolicyResult(null);
    setPolicyError(null);
  }

  async function handleApplyPolicy() {
    if (!selected) return;
    setPolicyLoading(true);
    setPolicyError(null);
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("You must be signed in.");

      const res = await fetch("/api/grades/apply-policy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId: selected.id,
          textCourseId: selected.course_id,
          gradingWeights: selected.gradingWeights,
          optimisticScore: optimistic,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to apply policy.");

      setPolicyResult({
        gradingPolicy:  json.gradingPolicy,
        projectedGrade: json.result.projectedGrade,
        currentGrade:   json.result.currentGrade,
      });
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setPolicyLoading(false);
    }
  }

  if (!selected) {
    return (
      <div>
        <PageHeader
          eyebrow="What-if scenarios"
          title="Grade calculator"
          description="Load at least one course with grading data to start modeling outcomes."
        />
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">
            No courses are available yet. Upload a syllabus and generate course data first, then come back to model grade scenarios.
          </CardBody>
        </Card>
      </div>
    );
  }

  const displayProjected = policyResult?.projectedGrade ?? projected;
  const isPolicyActive = policyResult !== null;

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
            onClick={() => handleSelectCourse(c.id)}
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
                  selected.gradingWeights.forEach((g) => {
                    updateGradeScore(selected.id, g.id, undefined);
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

          {/* AI Policy Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Implicit grading policies</CardTitle>
                <p className="text-xs text-muted mt-1">
                  Apply special rules from the syllabus (drop lowest, curves, attendance penalties)
                </p>
              </div>
              <Button
                size="sm"
                variant={isPolicyActive ? "secondary" : "primary"}
                onClick={handleApplyPolicy}
                loading={policyLoading}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isPolicyActive ? "Re-apply policy" : "Apply implicit grading policies from the syllabus"}
              </Button>
            </CardHeader>

            {(policyResult || policyError) && (
              <CardBody className="space-y-4">
                {policyError && (
                  <p className="text-xs text-danger">{policyError}</p>
                )}

                {policyResult && (
                  <>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-muted font-medium mb-2">
                        Implicit grading policy identified
                      </div>
                      <div className="rounded-xl border border-border bg-[hsl(var(--surface-2))] p-3 text-xs text-muted leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {policyResult.gradingPolicy}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl border border-accent/30 bg-[hsl(var(--accent-soft))]/20">
                      <Sparkles className="h-4 w-4 text-accent shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-accent">
                          Policy-adjusted projected grade
                        </div>
                        <div className="font-mono text-lg font-semibold">
                          {policyResult.projectedGrade.toFixed(1)}%
                          <span className="ml-2 text-sm font-normal text-muted">
                            {letter(policyResult.projectedGrade)} · {gpa(policyResult.projectedGrade).toFixed(2)} GPA
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardBody>
            )}
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
                <div>
                  <CardTitle>Projected final</CardTitle>
                  {isPolicyActive && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Sparkles className="h-3 w-3 text-accent" />
                      <span className="text-[10px] text-accent font-medium">Policy-adjusted</span>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col items-center text-center py-4">
                <GradeRing grade={displayProjected} size={120} stroke={8} />
                <div className="mt-3 font-mono text-2xl font-semibold">
                  {displayProjected.toFixed(1)}%
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {letter(displayProjected)} · {gpa(displayProjected).toFixed(2)} GPA
                </div>
                {isPolicyActive && (
                  <div className="mt-2 text-[11px] text-muted/70">
                    Standard: {projected.toFixed(1)}%
                  </div>
                )}
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
