import { C, DETAIL_WIDTH, LINE_WIDTH } from "./palette";

const r2 = (n: number) => Math.round(n * 100) / 100;

export function starPath(cx: number, cy: number, outer: number, inner = outer * 0.48, points = 5): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    parts.push(`${i === 0 ? "M" : "L"}${r2(cx + radius * Math.cos(angle))} ${r2(cy + radius * Math.sin(angle))}`);
  }
  return `${parts.join(" ")} Z`;
}

/** Four-point twinkle used for "clean / magic" accents. */
export function sparklePath(cx: number, cy: number, size: number): string {
  const s = size;
  const k = size * 0.28;
  return `M${cx} ${cy - s} Q${cx + k} ${cy - k} ${cx + s} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + s} Q${cx - k} ${cy + k} ${cx - s} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - s} Z`;
}

export function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    const pts: Array<[number, number]> = [
      [inner, a - step * 0.3],
      [outer, a - step * 0.2],
      [outer, a + step * 0.2],
      [inner, a + step * 0.3],
    ];
    for (const [radius, angle] of pts) {
      parts.push(`${parts.length === 0 ? "M" : "L"}${r2(cx + radius * Math.cos(angle))} ${r2(cy + radius * Math.sin(angle))}`);
    }
  }
  return `${parts.join(" ")} Z`;
}

/** Circle A minus circle B, as one path (no masks → no id collisions). */
export function crescentPath(
  ax: number,
  ay: number,
  ra: number,
  bx: number,
  by: number,
  rb: number,
): string {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const a = (ra * ra - rb * rb + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ra * ra - a * a));
  const mx = ax + (a * dx) / d;
  const my = ay + (a * dy) / d;
  const p1 = [r2(mx + (h * dy) / d), r2(my - (h * dx) / d)];
  const p2 = [r2(mx - (h * dy) / d), r2(my + (h * dx) / d)];
  return `M${p1[0]} ${p1[1]} A${ra} ${ra} 0 1 0 ${p2[0]} ${p2[1]} A${rb} ${rb} 0 0 1 ${p1[0]} ${p1[1]} Z`;
}

export function dropPath(cx: number, top: number, radius: number): string {
  const cy = top + radius * 1.9;
  return `M${cx} ${top} C${cx} ${top} ${r2(cx - radius)} ${r2(cy - radius * 0.9)} ${r2(cx - radius)} ${cy} A${radius} ${radius} 0 0 0 ${r2(cx + radius)} ${cy} C${r2(cx + radius)} ${r2(cy - radius * 0.9)} ${cx} ${top} ${cx} ${top} Z`;
}

type PathProps = { d: string };

/** The single highlight each motif gets. */
export function Shine({ d, width = 2.5 }: PathProps & { width?: number }) {
  return <path d={d} stroke={C.shine} strokeWidth={width} fill="none" />;
}

/** Free-standing strokes (speed lines, steam): flip colour in dark mode. */
export function Lines({ d, width = DETAIL_WIDTH }: PathProps & { width?: number }) {
  return <path d={d} stroke={C.motion} strokeWidth={width} fill="none" />;
}

/** Detail stroke inside a shape (seams, ruled lines, finger gaps). */
export function Detail({ d, color = C.line, width = DETAIL_WIDTH }: PathProps & { color?: string; width?: number }) {
  return <path d={d} stroke={color} strokeWidth={width} fill="none" />;
}

export function circlePath(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

/**
 * A thick outlined tube (handle, hose, ray): outline pass + colour pass on the
 * same path gives a rounded capsule of `width` with the standard contour.
 */
export function Tube({ d, color, width }: PathProps & { color: string; width: number }) {
  return (
    <>
      <path d={d} stroke={C.line} strokeWidth={width + LINE_WIDTH * 2} fill="none" />
      <path d={d} stroke={color} strokeWidth={width} fill="none" />
    </>
  );
}

export function Dot({ cx, cy, r = 1.9, color = C.line }: { cx: number; cy: number; r?: number; color?: string }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} stroke="none" />;
}
