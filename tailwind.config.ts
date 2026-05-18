import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
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
        bg: "hsl(var(--bg) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        ink: "hsl(var(--ink) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        accent: {
          peach: "hsl(var(--accent-peach) / <alpha-value>)",
          mint: "hsl(var(--accent-mint) / <alpha-value>)",
          sun: "hsl(var(--accent-sun) / <alpha-value>)",
          sky: "hsl(var(--accent-sky) / <alpha-value>)",
          lilac: "hsl(var(--accent-lilac) / <alpha-value>)",
          rose: "hsl(var(--accent-rose) / <alpha-value>)",
          teal: "hsl(var(--accent-teal) / <alpha-value>)",
          sand: "hsl(var(--accent-sand) / <alpha-value>)",
        },
        brand: {
          coral: "hsl(var(--brand-coral) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-geist)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(27 31 59 / 0.04), 0 4px 16px -4px rgb(27 31 59 / 0.06)",
        lift: "0 4px 12px -2px rgb(27 31 59 / 0.08), 0 12px 32px -8px rgb(27 31 59 / 0.10)",
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
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "slide-up": "slide-up 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
