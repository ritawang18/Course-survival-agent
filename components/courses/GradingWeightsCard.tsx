import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import type { Course } from "@/lib/store/types";

export function GradingWeightsCard({ course }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Grading breakdown</CardTitle>
          <p className="text-xs text-muted mt-1">From parsed syllabus</p>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {course.gradingWeights.map((g) => (
          <div key={g.id}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{g.name}</span>
              <span className="text-muted font-mono">
                {g.earned != null ? `${g.earned}%` : "—"} · {g.weight}% weight
              </span>
            </div>
            <Progress
              value={g.earned ?? 0}
              className="mt-1.5 h-1.5"
              indicatorClassName={g.earned == null ? "bg-border" : undefined}
            />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
