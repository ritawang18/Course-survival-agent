import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Course } from "@/lib/store/types";
import { Check, CircleDot, Clock } from "lucide-react";

const statusConfig = {
  done: { icon: Check, variant: "success" as const, label: "Done" },
  in_progress: { icon: CircleDot, variant: "accent" as const, label: "In progress" },
  upcoming: { icon: Clock, variant: "muted" as const, label: "Upcoming" },
};

export function LectureModulesList({ course }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lecture modules</CardTitle>
        <Badge variant="muted">{course.modules.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-1">
        {course.modules.map((m) => {
          const cfg = statusConfig[m.status];
          const Icon = cfg.icon;
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
            >
              <div className="h-7 w-7 rounded-lg muted-surface flex items-center justify-center text-[11px] font-mono text-muted">
                W{m.week}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.title}</div>
                <div className="text-[11px] text-muted">
                  {m.resources} resources
                </div>
              </div>
              <Badge variant={cfg.variant}>
                <Icon className="h-3 w-3" />
                {cfg.label}
              </Badge>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
