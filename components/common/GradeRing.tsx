import { cn } from "@/lib/utils/cn";
import { letter } from "@/lib/utils/grade";

export function GradeRing({
  grade,
  size = 56,
  stroke = 5,
  label,
  className,
  tone = "accent",
}: {
  grade: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
  tone?: "accent" | "success" | "warning" | "danger";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, grade)) / 100) * circumference;
  const color =
    tone === "success"
      ? "stroke-success"
      : tone === "warning"
      ? "stroke-warning"
      : tone === "danger"
      ? "stroke-danger"
      : "stroke-accent";

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          className="stroke-[hsl(var(--surface-2))]"
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(color, "transition-[stroke-dashoffset] duration-700")}
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xs font-semibold">{letter(grade)}</span>
        {label && <span className="text-[9px] text-muted mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
