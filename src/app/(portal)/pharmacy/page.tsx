import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { isPharmaConfigured } from "@/lib/pharma/client";
import { listThreads } from "@/lib/pharma/chat";
import { listPharmacies } from "@/lib/pharma/directory";
import { FeatureDisabled } from "@/components/feature-disabled";
import { PharmaUnconfigured } from "@/components/pharma-unconfigured";
import { SectionMarker } from "@/components/section-marker";
import { CategoryTag, PriorityTag } from "@/components/topic-badges";
import { formatStamp } from "@/lib/format";
import type { TopicCategory, TopicPriority } from "@/lib/topics";

export default async function PharmacyChatPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Chat" />;
  }

  if (!isPharmaConfigured()) return <PharmaUnconfigured />;

  const [threads, pharmacies] = await Promise.all([
    listThreads(profile.organization),
    listPharmacies(),
  ]);
  const nameById = new Map(pharmacies.map((pharmacy) => [pharmacy.id, pharmacy.name]));

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionMarker index="03" label="Pharmacy" />
          <h1 className="mt-4 font-serif text-3xl text-ink">Pharmacy Chat</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {threads.length}{" "}
            {threads.length === 1 ? "conversation" : "conversations"} with the
            pharmacy
          </p>
        </div>
        <Link
          href="/pharmacy/new"
          className="label-mono inline-flex items-center gap-2 rounded-btn bg-accent px-4 py-2.5 text-white transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New chat
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-8 text-center">
          <p className="text-[15px] text-ink">No chats here yet.</p>
          <p className="mt-1.5 text-[14px] text-muted">
            Start a chat with a pharmacy member.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                href={`/pharmacy/${thread.id}`}
                className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-sunken"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryTag category={(thread.category ?? "general") as TopicCategory} />
                    <PriorityTag priority={(thread.priority ?? "normal") as TopicPriority} />
                    {thread.status === "closed" && (
                      <span className="label-mono text-muted">Closed</span>
                    )}
                  </div>
                  <p className="mt-2 truncate font-serif text-lg text-ink">
                    {thread.topic ?? "(no subject)"}
                  </p>
                  <p className="label-mono mt-1 truncate text-muted">
                    {nameById.get(thread.pharmacy_id) ?? "Pharmacy"}
                  </p>
                </div>
                <span className="label-mono shrink-0 text-muted">
                  {formatStamp(thread.created_at)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
