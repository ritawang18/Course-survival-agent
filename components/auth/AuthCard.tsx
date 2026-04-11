import { cn } from "@/lib/utils/cn";

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card-surface p-7 md:p-8", className)}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted mt-1.5">{description}</p>
        )}
      </div>
      {children}
      {footer && (
        <div className="mt-6 pt-5 border-t border-border/60 text-center text-sm text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
