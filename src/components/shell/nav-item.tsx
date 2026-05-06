"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  variant?: "sidebar" | "bottom";
  className?: string;
};

export function NavItem({
  href,
  label,
  icon: Icon,
  active = false,
  variant = "sidebar",
  className,
}: NavItemProps) {
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          "tap-target flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1 transition-colors",
          active ? "bg-ink/5 dark:bg-ink/10 text-ink" : "text-muted hover:text-ink",
          className,
        )}
      >
        <Icon className="size-5" strokeWidth={active ? 2.25 : 2} />
        <span className={cn("text-[11px] font-medium", active ? "text-ink" : "text-muted")}>
          {label}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "tap-target flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-ink/5 dark:bg-ink/10 text-ink"
          : "text-muted hover:bg-ink/5 hover:text-ink dark:hover:bg-ink/10",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={active ? 2.25 : 2} />
      <span>{label}</span>
    </Link>
  );
}
