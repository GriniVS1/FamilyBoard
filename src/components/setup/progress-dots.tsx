import { cn } from "@/lib/utils";

type ProgressDotsProps = {
  total: number;
  current: number;
};

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div
      className="flex items-center gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
    >
      {Array.from({ length: total }).map((_, idx) => (
        <span
          key={idx}
          className={cn(
            "h-2 rounded-full transition-all duration-200",
            idx === current
              ? "w-8 bg-ink"
              : idx < current
                ? "w-2 bg-ink/60"
                : "w-2 bg-border",
          )}
        />
      ))}
    </div>
  );
}
