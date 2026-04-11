import * as React from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant =
  | "default"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "muted"
  | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-[hsl(var(--surface-2))] text-text",
  accent: "bg-[hsl(var(--accent-soft))] text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  muted: "bg-transparent text-muted border border-border/60",
  outline: "bg-transparent text-text border border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
