"use client";

import { Lock } from "lucide-react";
import { Picto } from "@/components/pictos";
import { NAV_PICTO, type NavEntryKey } from "@/components/shared/nav-icons";
import { cn } from "@/lib/utils";
import { useNow } from "./use-now";

type NavPictoProps = {
  navKey: NavEntryKey;
  size: number;
  className?: string;
};

// The calendar motif carries a decorative grid; its lower page is covered by
// the real day of month. Numerals are not allowed inside a Picto, so this is
// an HTML overlay aligned to the motif's page (x 9-55, y 27-57 of 64).
function CalendarDay({ size }: { size: number }) {
  const now = useNow(60_000);
  if (!now) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute flex items-center justify-center rounded-b-[18%] font-display font-bold leading-none tabular"
      style={{
        left: "14%",
        right: "14%",
        top: "42%",
        bottom: "11%",
        fontSize: size * 0.4,
        backgroundColor: "hsl(var(--picto-white))",
        color: "hsl(var(--picto-line))",
      }}
    >
      {now.getDate()}
    </span>
  );
}

// Settings sit behind the admin PIN; the badge says so without words, the same
// way "Edit" on the chores page carries a lock.
function LockBadge({ size }: { size: number }) {
  const diameter = Math.round(size * 0.44);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-0.5 -right-0.5 inline-flex items-center justify-center rounded-full border-2 border-[hsl(var(--picto-line))] bg-[hsl(var(--picto-yellow))] text-[hsl(var(--picto-line))]"
      style={{ width: diameter, height: diameter }}
    >
      <Lock style={{ width: diameter * 0.55, height: diameter * 0.55 }} strokeWidth={3} />
    </span>
  );
}

export function NavPicto({ navKey, size, className }: NavPictoProps) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <Picto name={NAV_PICTO[navKey]} size={size} />
      {navKey === "calendar" && <CalendarDay size={size} />}
      {navKey === "settings" && <LockBadge size={size} />}
    </span>
  );
}
