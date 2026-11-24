import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Database, ListChecks, MessagesSquare, Users } from "lucide-react";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags, type FeatureFlags } from "@/lib/features";
import { getRecentActivity } from "@/lib/activity";
import { formatStamp } from "@/lib/format";
import { SectionMarker } from "@/components/section-marker";
import { ActionCard } from "@/components/action-card";
import { UnreadBadge } from "@/components/topic-badges";
import { listMyPharmacies } from "@/lib/sites/data";

const NO_FLAGS: FeatureFlags = {
  employee_team_chat: false,
  employee_pharmacy_topics: false,
};

export default async function HomePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  const organization = profile?.organization ?? "Your organization";
  const flags = profile?.organization
    ? await getFeatureFlags(profile.organization)
    : NO_FLAGS;

  const [activity, pharmacies] = await Promise.all([
    getRecentActivity(flags, userId),
    listMyPharmacies(),
  ]);

  const firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0] || "there";
  const showPharmacy = flags.employee_pharmacy_topics;
  const showTeam = flags.employee_team_chat;

  return (
    <div className="animate-rise space-y-10 p-5 md:p-8">
      <header>
        <SectionMarker index="01" label="Overview" />
        <h1 className="text-reveal mt-5 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          Welcome back, <span className="text-accent">{firstName}</span>.
        </h1>
        <p className="label-mono mt-3 text-muted">{organization}</p>
      </header>

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">
          Quick actions
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <ActionCard
            href="/drugs"
            icon={Database}
            title="Drug Database"
            description="Look up a drug by brand, generic name or DIN."
          />
          <ActionCard
            href="/interventions"
            icon={ListChecks}
            title="Intervention Codes"
            description="Find the right code for a pharmacist intervention."
          />
          {showPharmacy && (
            <ActionCard
              href="/pharmacy"
              icon={MessagesSquare}
              title="Chat with the pharmacy"
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
      </section>

      {pharmacies.length > 0 && (
        <section aria-labelledby="pharmacies-heading">
          <SectionMarker index="02" label="Your pharmacies" />
          <h2 id="pharmacies-heading" className="sr-only">
            Your pharmacies
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {pharmacies.map((pharmacy, index) => (
              <Link
                key={pharmacy.id}
                href={`/pharmacies/${pharmacy.id}/notices`}
                className="group hover-lift animate-rise stagger flex items-center gap-3 rounded-ledger border border-line bg-raised px-4 py-3.5 hover:border-accent"
                style={{ "--i": index } as CSSProperties}
              >
                <Building2 className="h-4 w-4 shrink-0 text-accent-soft" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{pharmacy.name}</span>
                <ArrowRight
                  className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent-soft"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="activity-heading">
        <SectionMarker index={pharmacies.length > 0 ? "03" : "02"} label="Recent activity" />
        <h2 id="activity-heading" className="sr-only">
          Recent activity
        </h2>

        {activity.length === 0 ? (
          <div className="mt-5 rounded-ledger border border-line bg-raised p-6">
            <p className="text-[14px] text-muted">
              No recent activity yet. Start a chat or message a colleague and it
              will appear here.
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
            {activity.map((item, index) => (
              <li
                key={item.id}
                className="animate-rise stagger"
                style={{ "--i": index } as CSSProperties}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-3.5 transition-all duration-200 ease-out hover:bg-sunken hover:pl-6"
                >
                  <span
                    className="label-mono w-20 shrink-0 text-muted"
                    aria-hidden="true"
                  >
                    {item.kind === "topic" ? "Pharmacy" : "Team"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                    {item.title}
                  </span>
                  <span className="label-mono shrink-0 text-muted">
                    {formatStamp(item.at)}
                  </span>
                  <UnreadBadge count={item.unread} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
