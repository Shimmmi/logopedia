import { Breadcrumb } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  crumbs,
  actions,
  className,
}: {
  title: string;
  description?: string;
  crumbs?: { href?: string; label: string }[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 space-y-2", className)}>
      {crumbs && <Breadcrumb items={crumbs} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1">{title}</h1>
          {description && <p className="mt-1 text-small text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
