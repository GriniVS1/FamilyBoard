import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "h-14 w-full rounded-2xl border border-border bg-surface px-5 text-lg text-ink placeholder:text-muted",
          "transition-shadow focus:ring-2 focus:ring-ink/20",
          "disabled:opacity-50 disabled:pointer-events-none",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
