import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getFeatureFlags } from "@/lib/features";
import { getThread } from "@/lib/topics";
import { FeatureDisabled } from "@/components/feature-disabled";
import { ThreadView } from "@/components/thread-view";

export default async function ThreadPage({
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
  if (!flags.employee_pharmacy_topics) {
    return <FeatureDisabled label="Pharmacy Topics" />;
  }

  const result = await getThread(params.id);
  if (!result) notFound();

  return (
    <ThreadView
      thread={result.thread}
      messages={result.messages}
      currentUserId={user.id}
    />
  );
}
