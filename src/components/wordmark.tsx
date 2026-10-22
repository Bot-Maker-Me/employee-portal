import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-serif text-lg leading-none text-ink", className)}>
      Employee <span className="text-accent-soft">Portal</span>
    </span>
  );
}
