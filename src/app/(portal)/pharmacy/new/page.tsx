import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { FeatureDisabled } from "@/components/feature-disabled";
import { SectionMarker } from "@/components/section-marker";
import { NewTopicForm } from "@/components/new-topic-form";

export default async function NewTopicPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Topics" />;
  }

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <Link
        href="/pharmacy"
        className="label-mono inline-flex items-center gap-2 text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to topics
      </Link>

      <div>
        <SectionMarker index="03" label="New topic" />
        <h1 className="mt-4 font-serif text-3xl text-ink">Start a topic</h1>
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
        <NewTopicForm />
      </div>
    </div>
  );
}
