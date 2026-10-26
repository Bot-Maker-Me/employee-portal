import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { getDirectory, listChannelSummaries } from "@/lib/channels";
import { FeatureDisabled } from "@/components/feature-disabled";
import { SectionMarker } from "@/components/section-marker";
import { ChannelList } from "@/components/channel-list";
import { NewChatDialog } from "@/components/new-chat-dialog";

export default async function TeamChatPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_team_chat) {
    return <FeatureDisabled label="Team Chat" />;
  }

  const [summaries, directory] = await Promise.all([
    listChannelSummaries(userId),
    getDirectory(),
  ]);

  const totalUnread = summaries.reduce((sum, s) => sum + s.unread, 0);

  return (
    <div className="animate-rise space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionMarker index="04" label="Team" />
          <h1 className="mt-4 font-serif text-3xl text-ink">Team Chat</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {totalUnread > 0
              ? `${totalUnread} unread ${totalUnread === 1 ? "message" : "messages"}`
              : "All caught up"}
          </p>
        </div>
        <NewChatDialog directory={directory} currentUserId={userId} />
      </div>

      <div className="flex max-w-2xl items-center gap-2 rounded-ledger border border-line bg-raised px-4 py-3">
        <p className="text-[13px] text-muted">
          Internal messages. Use resident IDs or initials, never full names.
        </p>
      </div>

      <ChannelList summaries={summaries} />
    </div>
  );
}
