import { LedgerCard } from "@/components/ledger-card";
import { cn } from "@/lib/utils";

const ROWS = [
  { id: "#4211", topic: "Order query", status: "Open", time: "09:14" },
  { id: "#4210", topic: "Delivery", status: "Closed", time: "08:52" },
  { id: "#4209", topic: "Clinical question", status: "Open", time: "Yest" },
] as const;

/**
 * Decorative "compliance register" preview for the login page.
 * Three nested layers so the transforms compose: tilt → hover-lift → float.
 * Decorative only (aria-hidden) — never applied to chat or forms.
 */
export function LedgerPreview() {
  return (
    <div className="relative w-full max-w-[23rem]" aria-hidden="true">
      <div className="-rotate-[1.5deg]">
        <div className="hover-lift">
          <div className="animate-float-soft">
            <LedgerCard className="paper-texture relative border border-paper-line px-6 py-5 shadow-float">
              <div className="flex items-baseline justify-between border-b border-paper-line pb-3.5">
                <span className="label-mono text-paper-muted">Register · Live</span>
                <span className="label-mono text-paper-muted">FY 26</span>
              </div>

              <ul className="mt-1">
                {ROWS.map((row) => (
                  <li
                    key={row.id}
                    className="border-b border-paper-line last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-4 py-3.5 transition-colors duration-200 hover:bg-paper-hover">
                      <span className="min-w-0">
                        <span className="block truncate font-serif text-[15px] leading-tight text-paper-ink">
                          {row.topic}
                        </span>
                        <span className="label-mono text-paper-muted">
                          {row.id}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            "label-mono block",
                            row.status === "Open"
                              ? "text-accent"
                              : "text-paper-muted",
                          )}
                        >
                          {row.status}
                        </span>
                        <span className="label-mono text-paper-muted">
                          {row.time}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </LedgerCard>
          </div>
        </div>
      </div>

      {/* SECURE stamp — hand-placed outside the tilt. */}
      <span className="absolute -right-4 -top-5 grid h-[4.6rem] w-[4.6rem] rotate-[10deg] place-items-center rounded-full border-2 border-accent bg-[radial-gradient(circle_at_38%_32%,var(--accent-tint),transparent_72%)] text-accent shadow-stamp">
        <span
          aria-hidden="true"
          className="absolute inset-[3px] rounded-full border border-accent-ring"
        />
        <span className="label-mono leading-none tracking-[0.16em]">Secure</span>
      </span>
    </div>
  );
}
