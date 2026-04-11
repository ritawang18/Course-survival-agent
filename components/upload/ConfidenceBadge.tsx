import { Badge } from "@/components/ui/Badge";

export function ConfidenceBadge({ value }: { value: number }) {
  if (value >= 0.9)
    return <Badge variant="success">High · {(value * 100).toFixed(0)}%</Badge>;
  if (value >= 0.75)
    return <Badge variant="accent">Good · {(value * 100).toFixed(0)}%</Badge>;
  if (value > 0)
    return (
      <Badge variant="warning">
        Needs review · {(value * 100).toFixed(0)}%
      </Badge>
    );
  return <Badge variant="muted">—</Badge>;
}
