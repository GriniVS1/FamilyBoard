"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { toneOf } from "@/components/kids/tone";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-semibold",
    "transition-colors duration-kid focus-ring-kid",
    "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent-sky text-on-accent shadow-pop active:shadow-press",
        secondary:
          "border-2 border-border bg-surface text-ink shadow-pop active:shadow-press",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        danger:
          "border-2 border-danger bg-danger-tint text-danger-ink active:shadow-press",
      },
      size: {
        default: "h-12 px-6 text-base",
        lg: "h-14 px-8 text-lg",
        kid: "kid-title h-16 px-7",
        icon: "size-12",
        "icon-lg": "size-16",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

type ButtonProps = Omit<HTMLMotionProps<"button">, "ref"> &
  VariantProps<typeof buttonVariants> & {
    /** Member colour for the primary fill; sky when omitted. */
    tone?: string | null;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, tone, type = "button", ...props }, ref) => {
    const toneFill = tone && (variant ?? "primary") === "primary" ? toneOf(tone).bg : undefined;
    return (
      <motion.button
        ref={ref}
        type={type}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(buttonVariants({ variant, size }), toneFill, className)}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

export { buttonVariants };
