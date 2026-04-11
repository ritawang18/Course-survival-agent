"use client";

import Link from "next/link";
import { UploadCloud, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store/AppStoreProvider";

export function QuickActionsBar() {
  const { replanStudy, replanning } = useAppStore();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/upload">
        <Button variant="primary" size="md">
          <UploadCloud className="h-4 w-4" />
          Upload syllabus
        </Button>
      </Link>
      <Link href="/assignments">
        <Button variant="secondary" size="md">
          <Plus className="h-4 w-4" />
          Add assignment
        </Button>
      </Link>
      <Button
        variant="secondary"
        size="md"
        loading={replanning}
        onClick={() => replanStudy()}
      >
        <Sparkles className="h-4 w-4" />
        {replanning ? "Generating…" : "Generate study plan"}
      </Button>
    </div>
  );
}
