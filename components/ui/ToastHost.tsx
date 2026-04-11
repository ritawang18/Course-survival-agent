"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";
import { useAppStore } from "@/lib/store/AppStoreProvider";
import { cn } from "@/lib/utils/cn";

const iconMap = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
} as const;

const kindStyles = {
  success: "text-success",
  warning: "text-warning",
  error: "text-danger",
  info: "text-accent",
} as const;

export function ToastHost() {
  const { toasts, dismissToast } = useAppStore();
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = iconMap[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "card-surface p-3 pr-4 flex items-start gap-3 pointer-events-auto animate-fade-in",
              "border-l-4",
              t.kind === "success" && "border-l-success",
              t.kind === "warning" && "border-l-warning",
              t.kind === "error" && "border-l-danger",
              t.kind === "info" && "border-l-accent"
            )}
          >
            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", kindStyles[t.kind])} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{t.title}</div>
              {t.description && (
                <div className="text-xs text-muted mt-0.5">{t.description}</div>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="text-muted hover:text-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
