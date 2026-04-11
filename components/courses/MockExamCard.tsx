"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Course } from "@/lib/store/types";
import { FileQuestion, Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function MockExamCard({ course }: { course: Course }) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
            <FileQuestion className="h-3.5 w-3.5 text-accent" />
          </div>
          <div>
            <CardTitle>Mock exam questions</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              AI-generated from your notes
            </p>
          </div>
        </div>
        <Badge variant="accent">{course.mockExamQuestions.length}</Badge>
      </CardHeader>
      <CardBody className="space-y-3">
        {course.mockExamQuestions.map((q, i) => {
          const isOpen = revealed[i];
          return (
            <div key={i} className="p-3 rounded-xl border border-border/60">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-medium leading-relaxed">{q.q}</div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setRevealed((p) => ({ ...p, [i]: !p[i] }))
                  }
                >
                  {isOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {isOpen ? "Hide" : "Reveal"}
                </Button>
              </div>
              {isOpen && (
                <div className="mt-2 text-xs text-muted leading-relaxed muted-surface rounded-lg p-2.5 animate-fade-in">
                  {q.a}
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
