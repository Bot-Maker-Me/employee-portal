import { redirect } from "next/navigation";
import { MessagesSquare, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags, type FeatureFlags } from "@/lib/features";
import { SectionMarker } from "@/components/section-marker";
import { ActionCard } from "@/components/action-card";

const NO_FLAGS: FeatureFlags = {
  employee_team_chat: false,
  employee_pharmacy_topics: false,
};

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  const organization = profile?.organization ?? "Your organization";
  const flags = profile?.organization
    ? await getFeatureFlags(profile.organization)
    : NO_FLAGS;

  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const showPharmacy = flags.employee_pharmacy_topics;
  const showTeam = flags.employee_team_chat;

  return (
    <div className="animate-rise space-y-10 p-5 md:p-8">
      <header>
        <SectionMarker index="01" label="Overview" />
        <h1 className="mt-5 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          Welcome back, <span className="text-accent">{firstName}</span>.
        </h1>
        <p className="label-mono mt-3 text-muted">{organization}</p>
      </header>

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">
          Quick actions
        </h2>
        {(showPharmacy || showTeam) ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {showPharmacy && (
              <ActionCard
                href="/pharmacy"
                icon={MessagesSquare}
                title="Start a topic with the pharmacy"
                description="Open a tracked question — orders, deliveries, clinical queries."
              />
            )}
            {showTeam && (
              <ActionCard
                href="/team"
                icon={Users}
                title="Message a colleague"
                description="Internal, real-time chat with your organization."
              />
            )}
          </div>
        ) : (
          <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
            Messaging features are switched off for your organization. Contact
            your administrator to enable them.
          </div>
        )}
      </section>

      <section aria-labelledby="activity-heading">
        <SectionMarker index="02" label="Recent activity" />
        <h2 id="activity-heading" className="sr-only">
          Recent activity
        </h2>
        <div className="mt-5 rounded-ledger border border-line bg-raised p-6">
          <p className="text-[14px] text-muted">
            No recent activity yet. Start a topic or message a colleague and it
            will appear here.
          </p>
        </div>
      </section>
    </div>
  );
}
