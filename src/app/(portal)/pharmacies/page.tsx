import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { isAdmin, isSuperAdmin } from "@/lib/profile";
import { listMyPharmacies } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { SectionMarker } from "@/components/section-marker";

export default async function PharmaciesPage() {
  const { profile } = await requirePortalUser();
  const pharmacies = await listMyPharmacies();

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header>
        <SectionMarker index="04" label="Pharmacies" />
        <h1 className="text-reveal mt-4 font-serif text-3xl text-ink">Your pharmacies</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Notices, policies, chat and formulary for each pharmacy you work with.
        </p>
      </header>

      {pharmacies.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">You haven’t been given access to a pharmacy yet.</p>
          <p className="mt-1.5 text-[14px] text-muted">
            {isAdmin(profile) ? (
              <Link href="/admin/pharmacies" className="text-accent-soft underline-offset-4 hover:underline">
                Set pharmacies up in Admin → Pharmacies
              </Link>
            ) : (
              "Ask an administrator to add you."
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pharmacies.map((pharmacy, index) => (
            <Link
              key={pharmacy.id}
              href={`/pharmacies/${pharmacy.id}/notices`}
              className="group hover-lift animate-rise stagger flex items-center gap-4 rounded-ledger border border-line bg-raised p-5 hover:border-accent"
              style={{ "--i": index } as CSSProperties}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-lg text-ink">{pharmacy.name}</span>
                {isSuperAdmin(profile) && (
                  <span className="label-mono block truncate text-muted">{pharmacy.organization}</span>
                )}
              </span>
              <ArrowRight
                className="h-4 w-4 text-accent-soft transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
