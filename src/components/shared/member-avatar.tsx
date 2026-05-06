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

type MemberAvatarProps = {
  name: string;
  color: string;
  emoji?: string | null;
  className?: string;
};

export function MemberAvatar({ name, color, emoji, className }: MemberAvatarProps) {
  const safeColor: MemberColor = isMemberColor(color) ? color : "sand";
  const initial = name?.trim()?.charAt(0)?.toUpperCase() ?? "?";

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
    >
      {emoji ? (
        <span className="leading-none" aria-hidden>
          {emoji}
        </span>
      ) : (
        <span className="font-display text-base leading-none" aria-hidden>
          {initial}
        </span>
      )}
    </span>
  );
}
