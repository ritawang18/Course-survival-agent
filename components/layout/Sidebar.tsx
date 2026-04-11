"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ListChecks,
  UploadCloud,
  Calculator,
  Sparkles,
  GraduationCap,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/planner", label: "Study Planner", icon: Sparkles },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/assignments", label: "Assignments", icon: ListChecks },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/grades", label: "Grade Calculator", icon: Calculator },
  { href: "/insights", label: "Instructor Insights", icon: Lightbulb },
];

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "h-screen w-64 shrink-0 border-r border-border bg-surface/70 backdrop-blur",
        "flex flex-col sticky top-0",
        className
      )}
    >
      <div className="px-5 pt-6 pb-5 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <GraduationCap className="h-5 w-5 text-accent" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight">Course Tracker</span>
          <span className="text-[11px] text-muted">AI study planner</span>
        </div>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto scrollbar-thin">
        <div className="text-[10px] uppercase tracking-wider text-muted px-3 pt-2 pb-1">
          Workspace
        </div>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-3 px-3 h-9 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-[hsl(var(--accent-soft))] text-accent"
                      : "text-text/80 hover:bg-[hsl(var(--surface-2))] hover:text-text"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-accent" />
                  )}
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3">
        <div className="card-surface p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-violet-500 flex items-center justify-center text-white text-xs font-semibold">
            M
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium truncate">Marco Silva</div>
            <div className="text-[11px] text-muted truncate">Spring 2026 · 18 units</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
