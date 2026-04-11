"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Soft decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-[hsl(var(--accent-soft))] blur-3xl opacity-60" />
        <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-violet-200/40 blur-3xl opacity-60 dark:bg-violet-900/20" />
      </div>

      <header className="relative z-10 px-6 lg:px-10 py-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-accent" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">
              Course Tracker
            </span>
            <span className="text-[11px] text-muted">AI study planner</span>
          </div>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[440px]">{children}</div>
      </main>

      <footer className="relative z-10 px-6 py-6 text-center text-[11px] text-muted">
        © {new Date().getFullYear()} Course Tracker · Built for students
      </footer>
    </div>
  );
}
