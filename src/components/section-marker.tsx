import { cn } from "@/lib/utils";

/**
 * Signature section marker: a short crimson line + mono label.
 * e.g.  — § 01 · INBOX
 */
export function SectionMarker({
  index,
  label,
  className,
}: {
  index: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="h-px w-8 shrink-0 bg-accent" aria-hidden="true" />
      <span className="label-mono text-accent-soft">
        § {index} · {label}
      </span>
    </div>
  );
}
