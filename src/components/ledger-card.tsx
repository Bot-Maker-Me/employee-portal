import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Cream "ledger" card used for register-style surfaces. */
export function LedgerCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-ledger bg-paper p-6 text-paper-ink shadow-ledger",
        className,
      )}
      {...props}
    />
  );
}
