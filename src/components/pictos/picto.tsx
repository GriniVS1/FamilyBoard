import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { MOTIFS } from "./motifs";
import { C, LINE_WIDTH } from "./palette";
import type { PictoName } from "./registry";

type PictoProps = Omit<SVGProps<SVGSVGElement>, "name" | "children" | "viewBox"> & {
  name: PictoName;
  /** Rendered edge length; number = px. Drawn for 40–120 px. */
  size?: number | string;
  /** Accessible name. Omit when a visible label or the parent already names it. */
  label?: string;
};

/**
 * Server-safe (no hooks). The `.picto-motion` group animates only while an
 * ancestor has data-picto-demo="true" — see `usePictoDemo`.
 */
export function Picto({ name, size = 64, className, label, ...rest }: PictoProps) {
  const motif = MOTIFS[name];
  const a11y = label
    ? { role: "img" as const, "aria-label": label }
    : { "aria-hidden": true as const, focusable: "false" as const };

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      data-picto={name}
      className={cn("picto inline-block shrink-0 select-none", className)}
      {...a11y}
      {...rest}
    >
      <g
        fill="none"
        stroke={C.line}
        strokeWidth={LINE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif.back}
        <g
          className="picto-motion"
          data-motion={motif.motion}
          style={{ transformOrigin: motif.origin ?? "32px 32px" }}
        >
          {motif.move}
        </g>
        {motif.front}
      </g>
    </svg>
  );
}
