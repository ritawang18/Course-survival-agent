import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Course } from "@/lib/store/types";
import { ArrowRight, Link2 } from "lucide-react";

export function DependencyGraphCard({ course }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
            <Link2 className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <CardTitle>Assignment dependencies</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Inferred from syllabus & content
            </p>
          </div>
        </div>
        <Badge variant="muted">{course.dependencyNotes.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {course.dependencyNotes.map((d, i) => (
          <div
            key={i}
            className="p-3 rounded-xl muted-surface"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium truncate">{d.from}</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted shrink-0" />
              <span className="text-accent font-medium truncate">{d.to}</span>
            </div>
            <p className="text-[11px] text-muted mt-1">{d.why}</p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
