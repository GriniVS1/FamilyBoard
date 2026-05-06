import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MEMBER_COLORS = [
  "peach",
  "mint",
  "sun",
  "sky",
  "lilac",
  "rose",
  "teal",
  "sand",
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

export function isMemberColor(value: string): value is MemberColor {
  return (MEMBER_COLORS as readonly string[]).includes(value);
}
