import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { SectionMarker } from "@/components/section-marker";

/**
 * Shown when a route is reachable but its feature flag is OFF for the
 * organization. Route access is blocked, data is never loaded.
 */
export function FeatureDisabled({ label }: { label: string }) {
  return (
    <div className="animate-rise p-5 md:p-8">
      <SectionMarker index="00" label="Restricted" />
      <div className="mt-6 flex max-w-lg items-start gap-4 rounded-ledger border border-line bg-raised p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-serif text-2xl text-ink">{label} isn’t enabled</h1>
          <p className="mt-2 text-[14px] text-muted">
            This feature is switched off for your organization. Ask your
            administrator to enable it, then sign in again.
          </p>
          <Link
            href="/home"
            className="label-mono mt-4 inline-block text-accent-soft underline-offset-4 hover:underline"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
