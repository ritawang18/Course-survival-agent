import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "accent",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneMap = {
    accent: "bg-[hsl(var(--accent-soft))] text-accent",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-danger/10 text-danger",
  } as const;
  return (
    <div className={cn("card-surface p-5", className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted font-medium">
            {label}
          </div>
          <div className="text-2xl font-semibold tracking-tight mt-1.5">{value}</div>
          {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
        </div>
        <div
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center",
            toneMap[tone]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
