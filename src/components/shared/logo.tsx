import { cn } from "@/lib/utils";

type LogoProps = {
  /** Font size in pixels (the donut "o" scales with it). Defaults to 28. */
  size?: number;
  className?: string;
  /** When true, render only the wordmark glyph (no "FamilyBoard" text) — used by app icons. */
  iconOnly?: boolean;
};

/**
 * FamilyBoard wordmark.
 *
 * - "Family" in --brand-coral
 * - "Board"  in --ink, with the "o" replaced by a bullseye glyph
 *   (dark ring + coral center) — this is the brand mark.
 *
 * The donut scales with `size`. Uses Geist (font-display) which is already
 * loaded on every page via `src/app/layout.tsx`.
 */
export function Logo({ size = 28, className, iconOnly = false }: LogoProps) {
  if (iconOnly) {
    return (
      <BullseyeGlyph
        size={size}
        className={className}
        aria-label="FamilyBoard"
      />
    );
  }

  return (
    <span
      className={cn(
        "font-display font-bold tracking-tight inline-flex items-baseline whitespace-nowrap",
        className,
      )}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
      aria-label="FamilyBoard"
      role="img"
    >
      <span className="text-brand-coral">Family</span>
      <span className="text-ink">B</span>
      <BullseyeGlyph
        size={size * 0.6}
        className="-mx-[0.04em]"
        aria-hidden
      />
      <span className="text-ink">ard</span>
    </span>
  );
}

type BullseyeProps = {
  size: number;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

/**
 * The "o" replacement — a dark ring (donut) with a coral center.
 * Outer stroke uses --ink so it auto-flips in dark mode; the center stays coral.
 */
function BullseyeGlyph({
  size,
  className,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
}: BullseyeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("inline-block align-baseline shrink-0", className)}
      style={{ transform: "translateY(0.03em)" }}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden}
    >
      {/* outer ring — uses currentColor via text-ink */}
      <circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        className="text-ink"
      />
      {/* inner dot — coral */}
      <circle
        cx="50"
        cy="50"
        r="14"
        fill="currentColor"
        className="text-brand-coral"
      />
    </svg>
  );
}
