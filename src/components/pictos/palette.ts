const v = (token: string) => `hsl(var(--picto-${token}))`;

// Illustrations may only reference these; raw colours would break dark mode.
export const C = {
  line: v("line"),
  motion: v("motion"),
  dark: v("dark"),
  shine: v("shine"),
  white: v("white"),
  cream: v("cream"),
  red: v("red"),
  orange: v("orange"),
  yellow: v("yellow"),
  green: v("green"),
  leaf: v("leaf"),
  blue: v("blue"),
  water: v("water"),
  purple: v("purple"),
  pink: v("pink"),
  brown: v("brown"),
  wood: v("wood"),
  skin: v("skin"),
  gray: v("gray"),
  steel: v("steel"),
} as const;

export const LINE_WIDTH = 2.75;
export const DETAIL_WIDTH = 2.25;
