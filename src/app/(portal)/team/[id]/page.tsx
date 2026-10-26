import { notFound, redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { getChannel, getDirectory } from "@/lib/channels";
import { FeatureDisabled } from "@/components/feature-disabled";
import { ChannelView } from "@/components/channel-view";

export default async function ChannelPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const profile = await getProfile(userId);
  if (!profile?.organization) redirect("/home");

  const flags = await getFeatureFlags(profile.organization);
  if (!flags.employee_team_chat) {
    return <FeatureDisabled label="Team Chat" />;
  }

  // Channel and directory are independent — fetch together.
  const [result, directory] = await Promise.all([
    getChannel(params.id, userId),
    getDirectory(),
  ]);
  if (!result) notFound();

  return (
    <ChannelView
      channel={result.channel}
      label={result.label}
      members={result.members}
      messages={result.messages}
      currentUserId={userId}
      directory={directory}
    />
  );
}
