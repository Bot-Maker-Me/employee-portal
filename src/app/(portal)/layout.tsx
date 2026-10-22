import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isProfileLinked } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { getActivitySummary } from "@/lib/activity";
import { PortalSidebar, PortalTabBar } from "@/components/portal-nav";
import { LiveTicker } from "@/components/live-ticker";
import { UserFooter } from "@/components/user-footer";
import { Wordmark } from "@/components/wordmark";
import { IdleTimeout } from "@/components/idle-timeout";
import { UnlinkedAccount } from "@/components/unlinked-account";

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

  // Fail closed: never render portal data without a linked profile.
  const profile = await getProfile(user.id);
  if (!isProfileLinked(profile)) {
    return <UnlinkedAccount />;
  }

  const flags = await getFeatureFlags(profile.organization);
  const { openTopics, unreadTopics, unreadChannels } =
    await getActivitySummary(flags);

  const totalUnread = unreadTopics + unreadChannels;
  const tickerItems = `${openTopics} open ${
    openTopics === 1 ? "topic" : "topics"
  } · ${totalUnread} unread`;
  const badges = { "/pharmacy": unreadTopics, "/team": unreadChannels };

  return (
    <div className="md:grid md:min-h-dvh md:grid-cols-[16rem_1fr]">
      <aside className="hidden border-r border-line md:flex md:flex-col md:py-4">
        <div className="px-6 pb-6">
          <Wordmark />
        </div>
        <div className="flex-1 px-3">
          <PortalSidebar flags={flags} badges={badges} />
        </div>
        <UserFooter profile={profile} />
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3 md:hidden">
          <Wordmark />
        </header>

        <LiveTicker items={tickerItems} />

        <main className="flex-1">{children}</main>

        <div className="md:hidden">
          <PortalTabBar flags={flags} badges={badges} />
        </div>
      </div>

      <IdleTimeout />
    </div>
  );
}
