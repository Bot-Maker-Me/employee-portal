import { LedgerCard } from "@/components/ledger-card";

const ROWS = [
  { id: "#4211", topic: "Order query", status: "Open", time: "09:14" },
  { id: "#4210", topic: "Delivery", status: "Closed", time: "08:52" },
  { id: "#4209", topic: "Clinical question", status: "Open", time: "Yest" },
];

/**
 * Decorative "compliance register" preview for the login page.
 * Tilted on purpose — decorative surfaces only, never chat or forms.
 */
export function LedgerPreview() {
  return (
    <div className="relative w-full max-w-sm -rotate-2" aria-hidden="true">
      <LedgerCard className="relative">
        <div className="flex items-center justify-between border-b border-paper-ink/10 pb-3">
          <span className="label-mono text-paper-ink/60">Register · Live</span>
          <span className="label-mono text-paper-ink/60">FY 26</span>
        </div>

        <ul className="mt-4 space-y-3">
          {ROWS.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 border-b border-paper-ink/10 pb-3 last:border-0 last:pb-0"
            >
              <span className="min-w-0">
                <span className="block truncate font-serif text-[15px] text-paper-ink">
                  {row.topic}
                </span>
                <span className="label-mono text-paper-ink/50">{row.id}</span>
              </span>
              <span className="text-right">
                <span className="label-mono block text-paper-ink/70">{row.status}</span>
                <span className="label-mono text-paper-ink/50">{row.time}</span>
              </span>
            </li>
          ))}
        </ul>

        <span className="absolute -right-3 -top-4 grid h-16 w-16 rotate-12 place-items-center rounded-full border-2 border-accent text-center text-accent">
          <span className="label-mono leading-tight">Secure</span>
        </span>
      </LedgerCard>
    </div>
  );
}
