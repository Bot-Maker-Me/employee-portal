import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { FeatureDisabled } from "@/components/feature-disabled";
import { SectionMarker } from "@/components/section-marker";

export default async function TeamChatPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_team_chat) {
    return <FeatureDisabled label="Team Chat" />;
  }

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <SectionMarker index="04" label="Team" />
      <h1 className="font-serif text-3xl text-ink">Team Chat</h1>
      <div className="rounded-ledger border border-line bg-raised p-6">
        <p className="text-[14px] text-muted">
          Direct and group chat are built in Phase 3, together with the
          employee channel tables. Enable the flag only when that phase ships.
        </p>
      </div>
    </div>
  );
}
