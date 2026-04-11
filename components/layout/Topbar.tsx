"use client";

import { Bell, Search, Command, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";

export function Topbar({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-bg/80 backdrop-blur flex items-center gap-3 px-5 lg:px-8">
      <button
        onClick={onOpenSidebar}
        className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-[hsl(var(--surface-2))]"
      >
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={() => setCommandOpen(true)}
        className="group hidden md:flex items-center gap-2.5 h-9 px-3 rounded-xl border border-border bg-surface hover:border-accent/40 transition-colors min-w-[320px] text-left"
      >
        <Search className="h-4 w-4 text-muted" />
        <span className="text-sm text-muted flex-1">
          Search courses, assignments, notes…
        </span>
        <kbd className="text-[10px] text-muted inline-flex items-center gap-0.5 px-1.5 h-5 rounded muted-surface font-mono">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <div className="flex-1" />

      <Button size="sm" variant="secondary" className="hidden md:inline-flex">
        <Plus className="h-3.5 w-3.5" />
        Quick add
      </Button>

      <button className="relative h-9 w-9 inline-flex items-center justify-center rounded-xl hover:bg-[hsl(var(--surface-2))] text-text/80">
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-danger" />
      </button>

      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-white text-xs font-semibold cursor-pointer">
        M
      </div>

      <Modal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        title="Command palette"
      >
        <div className="text-xs text-muted mb-3">
          Jump to a course, assignment, or action.
        </div>
        <input
          autoFocus
          placeholder="Type a command…"
          className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)]"
        />
        <div className="mt-4 space-y-1 text-sm">
          {[
            "Go to Dashboard",
            "Open CS 344 · Operating Systems",
            "Generate new study plan",
            "Upload syllabus PDF",
            "Mark attendance for today",
          ].map((item) => (
            <div
              key={item}
              className="px-3 h-9 flex items-center rounded-lg hover:bg-[hsl(var(--surface-2))] cursor-pointer text-text/90"
            >
              {item}
            </div>
          ))}
        </div>
      </Modal>
    </header>
  );
}
