import { cn } from "@/lib/utils/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6",
        className
      )}
    >
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-accent font-medium mb-1">
            {eyebrow}
          </div>
        )}
        <h1 className="text-2xl md:text-[28px] font-semibold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
