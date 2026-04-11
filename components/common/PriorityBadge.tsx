import { Badge } from "@/components/ui/Badge";
import type { Priority } from "@/lib/store/types";

const map: Record<Priority, { label: string; variant: "danger" | "warning" | "muted" }> = {
  urgent: { label: "Urgent", variant: "danger" },
  important: { label: "Important", variant: "warning" },
  optional: { label: "Optional", variant: "muted" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, variant } = map[priority];
  return (
    <Badge variant={variant}>
      <span
        className={
          variant === "danger"
            ? "w-1.5 h-1.5 rounded-full bg-danger"
            : variant === "warning"
            ? "w-1.5 h-1.5 rounded-full bg-warning"
            : "w-1.5 h-1.5 rounded-full bg-text-muted/60"
        }
      />
      {label}
    </Badge>
  );
}
