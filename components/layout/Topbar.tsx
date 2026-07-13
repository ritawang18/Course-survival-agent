"use client";

import { Bell, Search, Command, Plus, Menu, LogOut, KeyRound, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { getSupabaseClient } from "@/lib/supabase/client";
import Link from "next/link";

export function Topbar({ onOpenSidebar }: { onOpenSidebar?: () => void }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      // Belt-and-braces: also wipe any leftover sb-* localStorage keys so a
      // stale session from a previous project can't linger.
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
      // The (app) layout's onAuthStateChange listener will redirect to /login.
    } finally {
      setSigningOut(false);
      setAccountOpen(false);
    }
  };

  const initial = email?.[0]?.toUpperCase() ?? "M";

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

      <div className="relative">
        <button
          onClick={() => setAccountOpen((v) => !v)}
          className="h-9 flex items-center gap-2 pl-1.5 pr-2.5 rounded-full border border-border bg-surface hover:border-accent/40 transition-colors cursor-pointer"
          aria-label="Account menu"
          aria-expanded={accountOpen}
        >
          <span className="h-6 w-6 shrink-0 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-white text-[11px] font-semibold">
            {initial}
          </span>
          <span className="hidden md:inline text-xs font-medium text-text/90 max-w-[140px] truncate">
            {email ?? "Account"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted" />
        </button>

        {accountOpen && (
          <>
            {/* click-outside backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setAccountOpen(false)}
            />
            <div className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-border bg-surface shadow-card-hover overflow-hidden">
              <div className="px-3 py-3 border-b border-border/60">
                <div className="text-[10px] uppercase tracking-wider text-muted font-medium">
                  Signed in as
                </div>
                <div className="text-sm font-medium truncate mt-0.5">
                  {email ?? "Loading…"}
                </div>
              </div>
              <Link
                href="/settings"
                onClick={() => setAccountOpen(false)}
                className="w-full text-left px-3 py-2.5 text-sm text-text/90 hover:bg-[hsl(var(--surface-2))] flex items-center gap-2"
              >
                <KeyRound className="h-4 w-4" />
                Tokens & integrations
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full text-left px-3 py-2.5 text-sm text-text/90 hover:bg-[hsl(var(--surface-2))] flex items-center gap-2 disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </>
        )}
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
