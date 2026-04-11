"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { UploadZone } from "@/components/upload/UploadZone";
import { ParsingResultCard } from "@/components/upload/ParsingResultCard";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Sparkles, Shield, FileCheck2 } from "lucide-react";

export default function UploadPage() {
  const { data } = useAppStore();
  return (
    <div>
      <PageHeader
        eyebrow="Ingestion"
        title="Upload & extract"
        description="Drop a syllabus, set of notes, or assignment PDF. We'll parse it in seconds."
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-5">
        <div className="xl:col-span-2 space-y-4 lg:space-y-5">
          <UploadZone />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Recent uploads
              </h2>
              <span className="text-[11px] text-muted">
                {data.uploads.length} files processed
              </span>
            </div>
            <div className="space-y-4">
              {data.uploads.map((u) => (
                <ParsingResultCard key={u.id} artifact={u} />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-[hsl(var(--accent-soft))] flex items-center justify-center">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                </div>
                <CardTitle>How extraction works</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="text-xs text-muted space-y-3 leading-relaxed">
              <div className="flex gap-2">
                <span className="text-accent font-mono">01</span>
                <p>Files are OCR'd when needed, then parsed into structured sections.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-accent font-mono">02</span>
                <p>
                  Deadlines, weights, and exam dates are extracted with confidence
                  scores.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="text-accent font-mono">03</span>
                <p>
                  Low-confidence fields are flagged as{" "}
                  <span className="text-warning">Needs review</span> so you can
                  verify them before applying.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-success/10 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 text-success" />
                </div>
                <CardTitle>Your files stay private</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="text-xs text-muted leading-relaxed">
              Documents are processed on-device where possible. Extraction models
              never train on your uploads.
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-xl bg-warning/10 flex items-center justify-center">
                  <FileCheck2 className="h-3.5 w-3.5 text-warning" />
                </div>
                <CardTitle>Best results</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="text-xs text-muted space-y-1.5 leading-relaxed">
              <p>· Upload the official syllabus rather than a summary</p>
              <p>· Keep filenames meaningful (course code helps)</p>
              <p>· Combine lecture notes into chapters, not single pages</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
