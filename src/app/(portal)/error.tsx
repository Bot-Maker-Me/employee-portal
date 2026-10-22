"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/section-marker";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <div className="animate-rise p-5 md:p-8">
      <SectionMarker index="00" label="Error" />
      <div className="mt-6 flex max-w-lg items-start gap-4 rounded-ledger border border-line bg-raised p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-serif text-2xl text-ink">Something went wrong</h1>
          <p className="mt-2 text-[14px] text-muted">
            We couldn’t load this view. Please try again.
          </p>
          <div className="mt-5">
            <Button onClick={reset}>Try again</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
