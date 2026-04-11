"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  hint?: string;
}

export const PasswordField = React.forwardRef<
  HTMLInputElement,
  PasswordFieldProps
>(({ label, hint, className, id, ...props }, ref) => {
  const [show, setShow] = React.useState(false);
  const inputId = id ?? React.useId();
  return (
    <div className={className}>
      <label htmlFor={inputId} className="text-xs font-medium">
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          ref={ref}
          id={inputId}
          type={show ? "text" : "password"}
          className={cn(
            "h-10 w-full rounded-xl border border-border bg-surface pl-3 pr-10 text-sm outline-none",
            "placeholder:text-muted/70 transition-all",
            "focus:ring-4 focus:ring-[hsl(var(--accent)/0.12)] focus:border-accent/60"
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-[hsl(var(--surface-2))]"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-muted mt-1.5">{hint}</p>}
    </div>
  );
});
PasswordField.displayName = "PasswordField";
