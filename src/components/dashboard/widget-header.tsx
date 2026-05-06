import { cn } from "@/lib/utils";

type WidgetHeaderProps = {
  title: string;
  action?: React.ReactNode;
  className?: string;
};

export function WidgetHeader({ title, action, className }: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
      </span>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
