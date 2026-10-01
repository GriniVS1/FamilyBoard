import { cn } from "@/lib/utils";

type WidgetHeaderProps = {
  title: string;
  /** Replaces the default muted colour where the card tint is too strong for it. */
  titleClassName?: string;
  action?: React.ReactNode;
  className?: string;
};

export function WidgetHeader({ title, titleClassName, action, className }: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <span
        className={cn(
          "text-xs font-semibold uppercase tracking-[0.14em]",
          titleClassName ?? "text-muted",
        )}
      >
        {title}
      </span>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
