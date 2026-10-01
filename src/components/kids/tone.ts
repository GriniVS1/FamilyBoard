import { isMemberColor, type MemberColor } from "@/lib/utils";

// Tailwind's JIT only sees literal class names, so every per-member colour
// variant has to be spelled out here instead of built with a template string.

export type ToneClasses = {
  /** Strong accent fill (done card, primary button, progress arc via `stroke`). */
  bg: string;
  /** Soft surface for large areas (columns, picto tiles). */
  tint: string;
  /** Text/icon colour that stays ≥ 4.5:1 on `tint`. */
  ink: string;
  text: string;
  border: string;
  ring: string;
  stroke: string;
  strokeTint: string;
  fill: string;
};

const TONES: Record<MemberColor, ToneClasses> = {
  peach: {
    bg: "bg-accent-peach",
    tint: "bg-accent-peach-tint",
    ink: "text-accent-peach-ink",
    text: "text-accent-peach",
    border: "border-accent-peach",
    ring: "ring-accent-peach",
    stroke: "stroke-accent-peach",
    strokeTint: "stroke-accent-peach-tint",
    fill: "fill-accent-peach",
  },
  mint: {
    bg: "bg-accent-mint",
    tint: "bg-accent-mint-tint",
    ink: "text-accent-mint-ink",
    text: "text-accent-mint",
    border: "border-accent-mint",
    ring: "ring-accent-mint",
    stroke: "stroke-accent-mint",
    strokeTint: "stroke-accent-mint-tint",
    fill: "fill-accent-mint",
  },
  sun: {
    bg: "bg-accent-sun",
    tint: "bg-accent-sun-tint",
    ink: "text-accent-sun-ink",
    text: "text-accent-sun",
    border: "border-accent-sun",
    ring: "ring-accent-sun",
    stroke: "stroke-accent-sun",
    strokeTint: "stroke-accent-sun-tint",
    fill: "fill-accent-sun",
  },
  sky: {
    bg: "bg-accent-sky",
    tint: "bg-accent-sky-tint",
    ink: "text-accent-sky-ink",
    text: "text-accent-sky",
    border: "border-accent-sky",
    ring: "ring-accent-sky",
    stroke: "stroke-accent-sky",
    strokeTint: "stroke-accent-sky-tint",
    fill: "fill-accent-sky",
  },
  lilac: {
    bg: "bg-accent-lilac",
    tint: "bg-accent-lilac-tint",
    ink: "text-accent-lilac-ink",
    text: "text-accent-lilac",
    border: "border-accent-lilac",
    ring: "ring-accent-lilac",
    stroke: "stroke-accent-lilac",
    strokeTint: "stroke-accent-lilac-tint",
    fill: "fill-accent-lilac",
  },
  rose: {
    bg: "bg-accent-rose",
    tint: "bg-accent-rose-tint",
    ink: "text-accent-rose-ink",
    text: "text-accent-rose",
    border: "border-accent-rose",
    ring: "ring-accent-rose",
    stroke: "stroke-accent-rose",
    strokeTint: "stroke-accent-rose-tint",
    fill: "fill-accent-rose",
  },
  teal: {
    bg: "bg-accent-teal",
    tint: "bg-accent-teal-tint",
    ink: "text-accent-teal-ink",
    text: "text-accent-teal",
    border: "border-accent-teal",
    ring: "ring-accent-teal",
    stroke: "stroke-accent-teal",
    strokeTint: "stroke-accent-teal-tint",
    fill: "fill-accent-teal",
  },
  sand: {
    bg: "bg-accent-sand",
    tint: "bg-accent-sand-tint",
    ink: "text-accent-sand-ink",
    text: "text-accent-sand",
    border: "border-accent-sand",
    ring: "ring-accent-sand",
    stroke: "stroke-accent-sand",
    strokeTint: "stroke-accent-sand-tint",
    fill: "fill-accent-sand",
  },
};

export function toneOf(color: string | null | undefined): ToneClasses {
  return TONES[color && isMemberColor(color) ? color : "sand"];
}
