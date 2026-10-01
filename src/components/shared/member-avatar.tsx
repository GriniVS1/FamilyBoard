import { Check } from "lucide-react";
import { AvatarProgressRing } from "@/components/kids/avatar-progress-ring";
import { toneOf } from "@/components/kids/tone";
import { cn, isMemberColor, type MemberColor } from "@/lib/utils";

const COLOR_BG: Record<MemberColor, string> = {
  peach: "bg-accent-peach/40",
  mint: "bg-accent-mint/40",
  sun: "bg-accent-sun/40",
  sky: "bg-accent-sky/40",
  lilac: "bg-accent-lilac/40",
  rose: "bg-accent-rose/40",
  teal: "bg-accent-teal/40",
  sand: "bg-accent-sand/40",
};

export type AvatarSize = "sm" | "md" | "lg" | "xl";

type SizeSpec = {
  diameter: number;
  ring: number;
  progress: number;
  badge: number;
};

const SIZES: Record<AvatarSize, SizeSpec> = {
  sm: { diameter: 40, ring: 2, progress: 0, badge: 0 },
  md: { diameter: 56, ring: 3, progress: 4, badge: 22 },
  lg: { diameter: 72, ring: 3, progress: 5, badge: 28 },
  xl: { diameter: 96, ring: 4, progress: 6, badge: 32 },
};

/** Emoji share of the diameter; AK-21 asks for at least 55 %. */
const EMOJI_SCALE = 0.58;
const PROGRESS_GAP = 2;

type MemberAvatarProps = {
  name: string;
  color: string;
  emoji?: string | null;
  className?: string;
  /**
   * Omit for the legacy look: the caller sizes it through `className` and the
   * emoji scales with the box.
   */
  size?: AvatarSize;
  /** Today's chores; draws the progress ring. Pass only when `total > 0`. */
  progress?: { done: number; total: number };
  /** Open chores today. A number > 0 shows it, 0 shows a check. Omit for no badge. */
  openCount?: number;
  /** Track colour that stays visible on a tinted column instead of a white card. */
  onTint?: boolean;
};

export function MemberAvatar({
  name,
  color,
  emoji,
  className,
  size,
  progress,
  openCount,
  onTint = false,
}: MemberAvatarProps) {
  const safeColor: MemberColor = isMemberColor(color) ? color : "sand";
  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

  if (!size) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
          "border border-border text-ink",
          COLOR_BG[safeColor],
          className,
        )}
        style={{ containerType: "inline-size" }}
      >
        {emoji ? (
          <span className="leading-none" style={{ fontSize: `${EMOJI_SCALE * 100}cqw` }} aria-hidden>
            {emoji}
          </span>
        ) : (
          <span className="font-display leading-none" style={{ fontSize: "46cqw" }} aria-hidden>
            {initial}
          </span>
        )}
      </span>
    );
  }

  const spec = SIZES[size];
  const tone = toneOf(color);
  const showProgress = Boolean(progress && progress.total > 0) && spec.progress > 0;
  const inset = showProgress ? spec.progress + PROGRESS_GAP : 0;

  return (
    <span
      role="img"
      aria-label={name}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: spec.diameter, height: spec.diameter }}
    >
      {showProgress && progress && (
        <AvatarProgressRing
          diameter={spec.diameter}
          stroke={spec.progress}
          fraction={progress.done / progress.total}
          arcClassName={tone.stroke}
          trackClassName={onTint ? "stroke-surface/70" : tone.strokeTint}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "absolute flex items-center justify-center rounded-full",
          tone.tint,
          tone.ink,
          showProgress ? "" : cn("border-solid", tone.border),
        )}
        style={{
          inset,
          borderWidth: showProgress ? 0 : spec.ring,
        }}
      >
        {emoji ? (
          <span className="leading-none" style={{ fontSize: Math.round(spec.diameter * EMOJI_SCALE) }}>
            {emoji}
          </span>
        ) : (
          <span
            className="font-display font-semibold leading-none"
            style={{ fontSize: Math.round(spec.diameter * 0.46) }}
          >
            {initial}
          </span>
        )}
      </span>
      {openCount !== undefined && spec.badge > 0 && (
        <span
          aria-hidden
          className={cn(
            "absolute -right-1 -top-1 inline-flex items-center justify-center rounded-full",
            "border-2 border-surface kid-label tabular",
            openCount > 0 ? "bg-ink text-bg" : "bg-success text-surface",
          )}
          style={{ height: spec.badge, minWidth: spec.badge, paddingInline: 4 }}
        >
          {openCount > 0 ? (
            openCount
          ) : (
            <Check strokeWidth={3.5} style={{ width: spec.badge * 0.6, height: spec.badge * 0.6 }} />
          )}
        </span>
      )}
    </span>
  );
}
