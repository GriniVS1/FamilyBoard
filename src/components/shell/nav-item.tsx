"use client";

import Link from "next/link";
import { toneOf } from "@/components/kids/tone";
import { NAV_COLOR, type NavEntryKey } from "@/components/shared/nav-icons";
import { cn } from "@/lib/utils";
import { NavPicto } from "./nav-picto";

type NavTileProps = {
  href: string;
  label: string;
  navKey: NavEntryKey;
  active?: boolean;
  variant: "rail" | "bottom" | "sheet";
  onNavigate?: () => void;
  className?: string;
};

// The active state is carried by shape (tint + raised edge + bar), never by
// colour alone, so it survives colour-blindness and grayscale screenshots.
export function NavTile({
  href,
  label,
  navKey,
  active = false,
  variant,
  onNavigate,
  className,
}: NavTileProps) {
  const tone = toneOf(NAV_COLOR[navKey]);

  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "relative flex min-h-16 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 pb-1 pt-1.5",
          "transition-colors duration-kid ease-snappy focus-ring-kid active:scale-[0.96]",
          active && cn(tone.tint, "shadow-pop"),
          className,
        )}
      >
        {active && (
          <span
            aria-hidden
            className={cn("absolute inset-x-5 top-0 h-1 rounded-b-full", tone.bg)}
          />
        )}
        <span data-picto-demo={active ? "true" : undefined}>
          <NavPicto navKey={navKey} size={32} />
        </span>
        <span
          className={cn(
            "whitespace-nowrap text-[13px] font-semibold leading-4",
            // Long words ("Aujourd'hui") must still fit their 68 px slot on a 390 px phone.
            label.length > 9 ? "tracking-tighter" : "tracking-tight",
            active ? tone.ink : "text-ink",
          )}
        >
          {label}
        </span>
      </Link>
    );
  }

  if (variant === "sheet") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(
          "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-3xl px-2 py-3",
          tone.tint,
          "shadow-pop transition-transform duration-100 ease-snappy focus-ring-kid active:translate-y-0.5 active:shadow-press",
          active && cn("ring-[3px]", tone.ring),
          className,
        )}
      >
        {active && (
          <span
            aria-hidden
            className={cn("absolute inset-y-4 left-0 w-1 rounded-r-full", tone.bg)}
          />
        )}
        <NavPicto navKey={navKey} size={48} />
        <span className={cn("kid-label text-center", tone.ink)}>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-picto-demo={active ? "true" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5",
        "transition-[background-color,box-shadow] duration-kid ease-snappy focus-ring-kid-inset active:scale-[0.96]",
        active ? cn(tone.tint, "shadow-pop") : "hover:bg-ink/5",
        className,
      )}
    >
      {active && (
        <span
          aria-hidden
          className={cn("absolute -left-1 bottom-3 top-3 w-1 rounded-r-full", tone.bg)}
        />
      )}
      <NavPicto navKey={navKey} size={44} />
      <span
        className={cn(
          "kid-label max-w-full whitespace-nowrap tracking-tight",
          active ? tone.ink : "text-ink",
        )}
      >
        {label}
      </span>
    </Link>
  );
}
