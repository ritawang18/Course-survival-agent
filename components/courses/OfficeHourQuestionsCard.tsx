"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Course } from "@/lib/store/types";
import { Copy, Check, MessageCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";

export function OfficeHourQuestionsCard({ course }: { course: Course }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
            <MessageCircle className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <CardTitle>Office hour questions</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Suggested based on weak areas
            </p>
          </div>
        </div>
        <Badge variant="accent">{course.officeHourQuestions.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-2">
        {course.officeHourQuestions.map((q, i) => (
          <div
            key={i}
            className="flex items-start gap-2 p-3 rounded-xl muted-surface text-sm"
          >
            <span className="text-accent font-mono text-xs mt-0.5">Q{i + 1}</span>
            <span className="flex-1">{q}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(q).catch(() => {});
                setCopiedIdx(i);
                setTimeout(() => setCopiedIdx(null), 1200);
              }}
              className={cn(
                "h-6 w-6 rounded-md flex items-center justify-center text-muted hover:text-text hover:bg-surface shrink-0",
                copiedIdx === i && "text-success"
              )}
            >
              {copiedIdx === i ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
