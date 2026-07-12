import { Badge } from "@/components/ui/Badge";
import type { Priority } from "@/lib/store/types";

const map: Record<Priority, { label: string; variant: "danger" | "warning" | "muted" }> = {
  urgent: { label: "Urgent", variant: "danger" },
  important: { label: "Important", variant: "warning" },
  optional: { label: "Optional", variant: "muted" },
};

const dotClass: Record<"danger" | "warning" | "muted" | "success", string> = {
  danger: "w-1.5 h-1.5 rounded-full bg-danger",
  warning: "w-1.5 h-1.5 rounded-full bg-warning",
  muted: "w-1.5 h-1.5 rounded-full bg-text-muted/60",
  success: "w-1.5 h-1.5 rounded-full bg-success",
};

export function PriorityBadge({ priority }: { priority: Priority | "done" }) {
  if (priority === "done") {
    return (
      <Badge variant="success">
        <span className={dotClass.success} />
        Done
      </Badge>
    );
  }

  const { label, variant } = map[priority];
  return (
    <Badge variant={variant}>
      <span className={dotClass[variant]} />
      {label}
    </Badge>
  );
}
