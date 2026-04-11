import { cn } from "@/lib/utils/cn";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <div
      className={cn(
        "h-2 w-full rounded-full bg-[hsl(var(--surface-2))] overflow-hidden",
        className
      )}
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-all", indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
