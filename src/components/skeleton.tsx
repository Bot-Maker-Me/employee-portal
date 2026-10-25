import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** Placeholder that a soft shimmer sweeps across while data streams in. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      style={style}
      className={cn(
        "relative isolate overflow-hidden rounded-btn bg-raised",
        className,
      )}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}
