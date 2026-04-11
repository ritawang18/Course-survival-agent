"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { UploadCloud, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAppStore } from "@/lib/store/AppStoreProvider";

export function UploadZone() {
  const { simulateUpload } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    arr.forEach((f) => {
      simulateUpload(f.name);
    });
  };

  const handleSampleFile = (name: string) => {
    simulateUpload(name);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "card-surface p-8 flex flex-col items-center text-center border-2 border-dashed transition-all",
        dragging
          ? "border-accent bg-[hsl(var(--accent-soft))]/40"
          : "border-border/70"
      )}
    >
      <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--accent-soft))] flex items-center justify-center mb-3">
        <UploadCloud className="h-6 w-6 text-accent" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight">
        Drop syllabi, notes, or assignment PDFs
      </h3>
      <p className="text-sm text-muted mt-1 max-w-sm">
        We'll extract deadlines, grading weights, exam dates, and attendance
        policies automatically.
      </p>

      <div className="flex items-center gap-2 mt-5">
        <Button onClick={() => fileRef.current?.click()}>
          <UploadCloud className="h-4 w-4" />
          Choose files
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSampleFile("Sample-Syllabus.pdf")}
        >
          <FileText className="h-4 w-4" />
          Try a sample
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <p className="text-[11px] text-muted/80 mt-4">
        PDF, DOCX, JPG, PNG · up to 25 MB each
      </p>
    </div>
  );
}
