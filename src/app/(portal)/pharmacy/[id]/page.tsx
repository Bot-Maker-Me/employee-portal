import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { getThread } from "@/lib/pharma/chat";
import { listPharmacies } from "@/lib/pharma/directory";
import { getTenantGate, tenantVisible } from "@/lib/sites/data";
import { FeatureDisabled } from "@/components/feature-disabled";
import { PharmaUnconfigured } from "@/components/pharma-unconfigured";
import { ThreadView } from "@/components/thread-view";

export default async function PharmacyThreadPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Chat" />;
  }

  if (!isPharmaConfigured()) return <PharmaUnconfigured />;

  // The thread and the pharmacy directory are independent — fetch together.
  const [result, pharmacies, gate] = await Promise.all([
    getThread(params.id),
    listPharmacies(),
    getTenantGate(profile),
  ]);
  // RLS-equivalent guard: only the caller's organization may open this thread,
  // and only if they have access to that pharmacy.
  if (
    !result ||
    result.thread.organization_name !== profile.organization ||
    !tenantVisible(gate, result.thread.pharmacy_id)
  ) {
    notFound();
  }

  const pharmacyName =
    pharmacies.find((pharmacy) => pharmacy.id === result.thread.pharmacy_id)
      ?.name ?? "Pharmacy";

  return (
    <ThreadView
      thread={result.thread}
      messages={result.messages}
      pharmacyName={pharmacyName}
    />
  );
}
