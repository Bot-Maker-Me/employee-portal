import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { listPharmacies } from "@/lib/pharma/directory";
import { FeatureDisabled } from "@/components/feature-disabled";
import { PharmaUnconfigured } from "@/components/pharma-unconfigured";
import { SectionMarker } from "@/components/section-marker";
import { NewPharmacyChatForm } from "@/components/new-pharmacy-chat-form";

export default async function NewPharmacyChatPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  // The directory lives in the other project, so fetch it alongside the profile
  // rather than after it.
  const [profile, pharmacies] = await Promise.all([
    getProfile(userId),
    listPharmacies(),
  ]);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Chat" />;
  }

  if (!isPharmaConfigured()) return <PharmaUnconfigured />;

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <Link
        href="/pharmacy"
        className="label-mono inline-flex items-center gap-2 text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to chats
      </Link>

      <div>
        <SectionMarker index="03" label="New chat" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Start a chat</h1>
      </div>

      <div className="flex max-w-2xl items-start gap-3 rounded-ledger border border-accent/40 bg-accent-tint px-4 py-3">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-accent-soft"
          aria-hidden="true"
        />
        <p className="text-[13px] text-ink">
          Use resident IDs or initials, never full names. This is not an
          ordering channel.
        </p>
      </div>

      <div className="max-w-2xl rounded-ledger border border-line bg-raised p-6">
        {pharmacies.length === 0 ? (
          <p className="text-[14px] text-muted">
            No pharmacies are available to message yet.
          </p>
        ) : (
          <NewPharmacyChatForm pharmacies={pharmacies} />
        )}
      </div>
    </div>
  );
}
