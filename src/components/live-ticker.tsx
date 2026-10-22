export function LiveTicker({ items }: { items: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 md:px-6">
      <span className="inline-flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse-dot"
          aria-hidden="true"
        />
        <span className="label-mono text-accent-soft">Live</span>
      </span>
      <span className="truncate label-mono text-muted" title={items}>
        {items}
      </span>
    </div>
  );
}
