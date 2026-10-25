import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin, isApproved, isSuperAdmin } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { getActivitySummary } from "@/lib/activity";
import { PortalSidebar, PortalTabBar } from "@/components/portal-nav";
import { LiveTicker } from "@/components/live-ticker";
import { UserFooter } from "@/components/user-footer";
import { Wordmark } from "@/components/wordmark";
import { IdleTimeout } from "@/components/idle-timeout";
import { PushWatcher } from "@/components/push-watcher";
import { UnlinkedAccount } from "@/components/unlinked-account";
import { PendingApproval } from "@/components/pending-approval";
import type { FeatureFlags } from "@/lib/features";

const NO_FLAGS: FeatureFlags = {
  employee_team_chat: false,
  employee_pharmacy_topics: false,
};

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fail closed: never render portal data without a usable profile.
  const profile = await getProfile(user.id);
  if (!profile) return <UnlinkedAccount />;
  if (!isApproved(profile)) return <PendingApproval />;
  if (!profile.organization && !isSuperAdmin(profile)) return <UnlinkedAccount />;

  const admin = isAdmin(profile);
  const flags = profile.organization
    ? await getFeatureFlags(profile.organization)
    : NO_FLAGS;
  const { openTopics, unreadTopics, unreadChannels } =
    await getActivitySummary(flags);

  const totalUnread = unreadTopics + unreadChannels;
  const tickerItems = `${openTopics} open ${
    openTopics === 1 ? "chat" : "chats"
  } · ${totalUnread} unread`;
  const badges = { "/pharmacy": unreadTopics, "/team": unreadChannels };

  return (
    <div className="md:grid md:h-dvh md:grid-cols-[16rem_1fr]">
      <aside className="scroll-slim hidden border-r border-line md:flex md:min-h-0 md:flex-col md:overflow-y-auto md:py-4">
        <div className="px-6 pb-6">
          <Wordmark />
        </div>
        <div className="flex-1 px-3">
          <PortalSidebar flags={flags} badges={badges} isAdmin={admin} />
        </div>
        <UserFooter profile={profile} />
      </aside>

      <div className="flex h-dvh flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <Wordmark />
        </header>

        <LiveTicker items={tickerItems} />

        {/* The shell owns the viewport height, so scrolling happens here (and
            chats with a bounded height can scroll their own message list). */}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>

        <div className="md:hidden">
          <PortalTabBar flags={flags} badges={badges} isAdmin={admin} />
        </div>
      </div>

      <IdleTimeout />
      <PushWatcher userId={user.id} />
    </div>
  );
}
