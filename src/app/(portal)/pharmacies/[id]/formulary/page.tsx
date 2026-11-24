import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/profile";
import { getMyPharmacy, listRecords } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { RecordTable } from "@/components/sites/record-table";

export default async function PharmacyFormularyPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const { profile } = await requirePortalUser();
  const pharmacy = await getMyPharmacy(params.id);
  if (!pharmacy) notFound();
  const result = await listRecords({
    entity: "pharmacy_formulary",
    pharmacyId: pharmacy.id,
    query: searchParams.q,
  });
  return (
    <RecordTable
      entity="pharmacy_formulary"
      rows={result.rows}
      total={result.total}
      truncated={result.truncated}
      canEdit={isAdmin(profile)}
      pharmacyId={pharmacy.id}
      searchPlaceholder="Search chemical name, brand or DIN"
    />
  );
}
