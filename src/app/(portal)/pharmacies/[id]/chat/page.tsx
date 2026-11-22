import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Link2Off, Plus } from "lucide-react";
import { isAdmin } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { listThreads } from "@/lib/pharma/chat";
import { getMyPharmacy } from "@/lib/sites/data";
import { requirePortalUser } from "@/lib/sites/session";
import { FeatureDisabled } from "@/components/feature-disabled";
import { PharmaUnconfigured } from "@/components/pharma-unconfigured";
import { CategoryTag, PriorityTag } from "@/components/topic-badges";
import { formatStamp } from "@/lib/format";
import type { TopicCategory, TopicPriority } from "@/lib/topics";

/**
 * "Chat with Pharmacy" for one pharmacy: the organization's Pharmacy Chat
 * threads with this pharmacy's linked Pharma Portal tenant.
 */
export default async function PharmacySectionChatPage({ params }: { params: { id: string } }) {
  const { profile } = await requirePortalUser();
  const pharmacy = await getMyPharmacy(params.id);
  if (!pharmacy) notFound();

  if (!pharmacy.pharma_tenant_id) {
    return (
      <div className="flex max-w-xl items-start gap-4 rounded-ledger border border-line bg-raised p-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
          <Link2Off className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="font-serif text-xl text-ink">Chat isn’t connected for this pharmacy yet</p>
          <p className="mt-2 text-[14px] text-muted">
            {isAdmin(profile) ? (
              <>
                Link {pharmacy.name} to its Pharma Portal account in{" "}
                <Link href="/admin/pharmacies" className="text-accent-soft underline-offset-4 hover:underline">
                  Admin → Pharmacies
                </Link>{" "}
                and chats will show up here.
              </>
            ) : (
              "Ask an administrator to connect it."
            )}
          </p>
        </div>
      </div>
    );
  }

  const organization = profile.organization ?? pharmacy.organization;
  const flags = await getFeatureFlags(organization);
  if (!flags.employee_pharmacy_topics) return <FeatureDisabled label="Pharmacy Chat" />;
  if (!isPharmaConfigured()) return <PharmaUnconfigured />;

  const threads = (await listThreads(organization)).filter(
    (thread) => thread.pharmacy_id === pharmacy.pharma_tenant_id,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-muted">
          {threads.length} {threads.length === 1 ? "conversation" : "conversations"} with {pharmacy.name}
        </p>
        {profile.organization && (
          <Link
            href={`/pharmacy/new?pharmacy=${pharmacy.pharma_tenant_id}`}
            className="label-mono inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            New chat
          </Link>
        )}
      </div>

      {threads.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">No chats with {pharmacy.name} yet.</p>
          <p className="mt-1.5 text-[14px] text-muted">Start one with New chat.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
          {threads.map((thread, index) => (
            <li key={thread.id} className="animate-rise stagger" style={{ "--i": index } as CSSProperties}>
              <Link
                href={`/pharmacy/${thread.id}`}
                className="flex items-start gap-4 px-5 py-4 transition-all duration-200 ease-out hover:bg-sunken hover:pl-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryTag category={(thread.category ?? "general") as TopicCategory} />
                    <PriorityTag priority={(thread.priority ?? "normal") as TopicPriority} />
                    {thread.status === "closed" && <span className="label-mono text-muted">Closed</span>}
                  </div>
                  <p className="mt-2 truncate font-serif text-lg text-ink">{thread.topic ?? "(no subject)"}</p>
                </div>
                <span className="label-mono shrink-0 text-muted">{formatStamp(thread.created_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
