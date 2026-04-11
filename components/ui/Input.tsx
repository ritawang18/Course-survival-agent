import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none",
      "placeholder:text-muted/70 transition-all",
      "focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60",
      "disabled:opacity-60",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none",
      "placeholder:text-muted/70 transition-all",
      "focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
