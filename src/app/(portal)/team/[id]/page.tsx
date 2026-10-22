import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const result = await getChannel(params.id, user.id);
  if (!result) notFound();

  const directory = await getDirectory();

  return (
    <ChannelView
      channel={result.channel}
      label={result.label}
      members={result.members}
      messages={result.messages}
      currentUserId={user.id}
      directory={directory}
    />
  );
}
