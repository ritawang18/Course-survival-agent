import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Course } from "@/lib/store/types";
import { Sparkles } from "lucide-react";

export function AIInsightsCard({ course }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <CardTitle>AI insights</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Based on your syllabus, progress & past work
            </p>
          </div>
        </div>
        <Badge variant="accent">Personalized</Badge>
      </CardHeader>
      <CardBody>
        <p className="text-sm leading-relaxed text-text/90">{course.aiSummary}</p>
      </CardBody>
    </Card>
  );
}
