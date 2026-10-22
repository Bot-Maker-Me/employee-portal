import Link from "next/link";
import { SearchX } from "lucide-react";
import { SectionMarker } from "@/components/section-marker";

export default function PortalNotFound() {
  return (
    <div className="animate-rise p-5 md:p-8">
      <SectionMarker index="00" label="Not found" />
      <div className="mt-6 flex max-w-lg items-start gap-4 rounded-ledger border border-line bg-raised p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
          <SearchX className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-serif text-2xl text-ink">We couldn’t find that</h1>
          <p className="mt-2 text-[14px] text-muted">
            It may have been removed, or you don’t have access to it.
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
