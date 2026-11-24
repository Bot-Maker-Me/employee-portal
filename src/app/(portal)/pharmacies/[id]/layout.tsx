import { notFound } from "next/navigation";
import { getMyPharmacy } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { isSuperAdmin } from "@/lib/profile";
import { SectionMarker } from "@/components/section-marker";
import { PharmacyTabs } from "@/components/sites/pharmacy-tabs";

/**
 * Shell for one pharmacy's section. RLS only returns pharmacies the user was
 * given access to, so anyone else gets a 404 — never the content.
 */
export default async function PharmacySectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const { profile } = await requirePortalUser();
  const pharmacy = await getMyPharmacy(params.id);
  if (!pharmacy) notFound();

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <header>
        <SectionMarker index="04" label="Pharmacy" />
        <h1 className="text-reveal mt-4 font-serif text-3xl text-ink">{pharmacy.name}</h1>
        {isSuperAdmin(profile) && (
          <p className="label-mono mt-2 text-muted">{pharmacy.organization}</p>
        )}
      </header>
      <PharmacyTabs pharmacyId={pharmacy.id} />
      {children}
    </div>
  );
}
