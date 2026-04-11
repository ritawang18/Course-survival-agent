import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Course } from "@/lib/store/types";
import { FileText, FileType2 } from "lucide-react";

const kindLabel = {
  syllabus: "Syllabus",
  notes: "Notes",
  assignment: "Assignment",
} as const;

export function FilesCard({ course }: { course: Course }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploaded files</CardTitle>
        <Badge variant="muted">{course.files.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-1">
        {course.files.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-2))] transition-colors"
          >
            <div className="h-9 w-9 rounded-lg bg-[hsl(var(--surface-2))] flex items-center justify-center">
              <FileText className="h-4 w-4 text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{f.name}</div>
              <div className="text-[11px] text-muted">
                {kindLabel[f.kind]} · {f.pages} pages · {f.uploadedAt}
              </div>
            </div>
            <FileType2 className="h-4 w-4 text-muted" />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
