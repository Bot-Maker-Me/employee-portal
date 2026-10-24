import { PlugZap } from "lucide-react";
import { SectionMarker } from "@/components/section-marker";

/**
 * Shown when the Pharma Portal bridge has no service key configured. No data
 * is loaded and nothing breaks — it just tells the admin what to set.
 */
export function PharmaUnconfigured() {
  return (
    <div className="animate-rise p-5 md:p-8">
      <SectionMarker index="00" label="Setup" />
      <div className="mt-6 flex max-w-lg items-start gap-4 rounded-ledger border border-line bg-raised p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
          <PlugZap className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-serif text-2xl text-ink">
            Pharmacy Chat isn’t connected
          </h1>
          <p className="mt-2 text-[14px] text-muted">
            Set the{" "}
            <span className="label-mono text-ink">
              PHARMA_SUPABASE_SERVICE_ROLE_KEY
            </span>{" "}
            environment variable to link this portal to the Pharma Portal
            database, then reload.
          </p>
        </div>
      </div>
    </div>
  );
}
