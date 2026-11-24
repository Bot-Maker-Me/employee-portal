import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/profile";
import { getMyPharmacy, listPolicies } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { PolicyLibrary } from "@/components/sites/policy-library";

export default async function PharmacyPoliciesPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const { profile } = await requirePortalUser();
  const pharmacy = await getMyPharmacy(params.id);
  if (!pharmacy) notFound();
  const policies = await listPolicies(pharmacy.id);
  return <PolicyLibrary pharmacyId={pharmacy.id} policies={policies} canEdit={isAdmin(profile)} />;
}
