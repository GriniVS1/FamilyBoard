"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type GlassCardVariant = "default" | "glass";

type GlassCardProps = HTMLMotionProps<"div"> & {
  variant?: GlassCardVariant;
  interactive?: boolean;
};

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", interactive = false, children, ...props }, ref) => {
    const base =
      variant === "glass"
        ? "glass border border-border rounded-3xl shadow-soft"
        : "bg-surface border border-border rounded-3xl shadow-soft";

    const motionProps = interactive
      ? { whileHover: { y: -2 }, whileTap: { scale: 0.99 } }
      : {};

    return (
      <motion.div
        ref={ref}
        className={cn(base, className)}
        {...motionProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  },
);

GlassCard.displayName = "GlassCard";
