export function LiveTicker({ items }: { items: string }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden border-b border-line px-4 py-2.5 md:px-6">
      <span
        className="pointer-events-none absolute inset-0 animate-flow bg-[linear-gradient(90deg,transparent,var(--accent-tint),transparent)] bg-[length:200%_100%]"
        aria-hidden="true"
      />
      <span className="relative inline-flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 animate-pulse-dot rounded-full bg-accent"
          aria-hidden="true"
        />
        <span className="label-mono text-accent-soft">Live</span>
      </span>
      <span
        className="label-mono animate-rise-sm relative truncate text-muted"
        title={items}
      >
        {items}
      </span>
    </div>
  );
}
