"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-btn label-mono transition-all duration-200 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent px-4 py-2.5 text-white border border-transparent hover:-translate-y-px hover:bg-accent-hover hover:shadow-[0_12px_26px_-14px_var(--accent)]",
  secondary:
    "bg-transparent px-4 py-2.5 text-ink border border-line hover:-translate-y-px hover:border-accent hover:text-white",
  ghost: "bg-transparent px-3 py-2 text-muted hover:bg-raised hover:text-ink",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant = "primary", type = "button", ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(BASE, VARIANTS[variant], className)}
        {...props}
      />
    );
  },
);
