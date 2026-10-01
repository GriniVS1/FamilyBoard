import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const hsl = (token: string) => `hsl(var(--${token}) / <alpha-value>)`;

// DEFAULT keeps the existing `bg-accent-peach/30` call sites working.
const tone = (token: string) => ({
  DEFAULT: hsl(token),
  tint: hsl(`${token}-tint`),
  ink: hsl(`${token}-ink`),
});

const config: Config = {
  darkMode: "class",
  // Wall-mounted touchscreen: gate every `hover:` utility behind
  // `@media (hover: hover) and (pointer: fine)` so taps don't trigger sticky
  // hover states on the touch display.
  future: { hoverOnlyWhenSupported: true },
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1800px",
      },
    },
    extend: {
      colors: {
        bg: hsl("bg"),
        surface: hsl("surface"),
        ink: hsl("ink"),
        muted: hsl("muted"),
        border: hsl("border"),
        "on-accent": hsl("on-accent"),
        accent: {
          peach: tone("accent-peach"),
          mint: tone("accent-mint"),
          sun: tone("accent-sun"),
          sky: tone("accent-sky"),
          lilac: tone("accent-lilac"),
          rose: tone("accent-rose"),
          teal: tone("accent-teal"),
          sand: tone("accent-sand"),
        },
        success: tone("success"),
        danger: tone("danger"),
        warning: tone("warning"),
        focus: hsl("focus"),
        brand: {
          coral: hsl("brand-coral"),
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-geist)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      transitionTimingFunction: {
        // Strong ease-out — same curve as the slide-up animation. Built-in
        // CSS easings are too weak; reuse this for snappy, intentional motion.
        snappy: "cubic-bezier(0.22, 1, 0.36, 1)",
        // Slight overshoot for things that "land" (check mark, reward badge).
        pop: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        kid: "200ms",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(27 31 59 / 0.04), 0 4px 16px -4px rgb(27 31 59 / 0.06)",
        lift: "0 4px 12px -2px rgb(27 31 59 / 0.08), 0 12px 32px -8px rgb(27 31 59 / 0.10)",
        // Raised kid card: a crisp 2px "ledge" reads as pressable on a flat wall.
        pop: "0 2px 0 0 hsl(var(--shadow) / 0.08), 0 8px 20px -8px hsl(var(--shadow) / 0.22)",
        press: "inset 0 2px 0 0 hsl(var(--shadow) / 0.10)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.6)" },
          "60%": { opacity: "1", transform: "scale(1.08)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "check-pop": {
          "0%": { transform: "scale(0.4) rotate(-12deg)", opacity: "0" },
          "55%": { transform: "scale(1.18) rotate(4deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(0deg)", opacity: "1" },
        },
        "reward-rise": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.8)" },
          "20%": { opacity: "1", transform: "translateY(0) scale(1.1)" },
          "70%": { opacity: "1", transform: "translateY(-24px) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-40px) scale(0.95)" },
        },
        "star-fly": {
          "0%": { opacity: "0", transform: "translate(0, 0) scale(0.4) rotate(0deg)" },
          "25%": { opacity: "1" },
          "100%": {
            opacity: "0",
            transform: "translate(var(--fly-x, 0px), var(--fly-y, -60px)) scale(1) rotate(var(--fly-r, 90deg))",
          },
        },
        confetti: {
          "0%": { opacity: "1", transform: "translate(0, 0) rotate(0deg)" },
          "100%": {
            opacity: "0",
            transform: "translate(var(--fly-x, 0px), var(--fly-y, 120px)) rotate(var(--fly-r, 540deg))",
          },
        },
        "next-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 hsl(var(--focus) / 0)" },
          "50%": { boxShadow: "0 0 0 6px hsl(var(--focus) / 0.22)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "25%": { transform: "rotate(-6deg)" },
          "75%": { transform: "rotate(6deg)" },
        },
        "shake-soft": {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-4px)" },
          "40%, 80%": { transform: "translateX(4px)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "pop-in": "pop-in 220ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "check-pop": "check-pop 260ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "reward-rise": "reward-rise 1100ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "star-fly": "star-fly 700ms cubic-bezier(0.22, 1, 0.36, 1) both",
        confetti: "confetti 1200ms cubic-bezier(0.25, 0.6, 0.4, 1) both",
        "next-pulse": "next-pulse 2400ms ease-in-out infinite",
        wiggle: "wiggle 400ms ease-in-out 2",
        "shake-soft": "shake-soft 360ms ease-in-out",
        "toast-in": "toast-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1600ms linear infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
