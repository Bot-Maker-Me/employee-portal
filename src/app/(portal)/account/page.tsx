import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin as isAdminUser } from "@/lib/profile";
import { SignOutButton } from "@/components/sign-out-button";
import { SectionMarker } from "@/components/section-marker";
import { NotificationSettings } from "@/components/notification-settings";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-3 last:border-0">
      <dt className="label-mono text-muted">{label}</dt>
      <dd className="mt-1.5 text-[15px] text-ink">{value}</dd>
    </div>
  );
}

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  const isAdmin = isAdminUser(profile);

  return (
    <div className="animate-rise space-y-8 p-5 md:p-8">
      <header>
        <SectionMarker index="05" label="Account" />
        <h1 className="mt-5 font-serif text-3xl text-ink">Your account</h1>
      </header>

      <section className="max-w-2xl rounded-ledger border border-line bg-raised p-6">
        <dl>
          <Detail label="Name" value={profile?.full_name ?? "—"} />
          <Detail label="Email" value={profile?.email ?? user.email ?? "—"} />
          <Detail label="Organization" value={profile?.organization ?? "Not linked"} />
          <Detail
            label="Role"
            value={(profile?.role ?? "employee").replace("_", " ")}
          />
          <Detail
            label="Status"
            value={profile?.status === "active" ? "Approved" : "Pending"}
          />
        </dl>
      </section>

      <NotificationSettings userId={user.id} isAdmin={isAdmin} />

      <section className="max-w-2xl space-y-3">
        <SectionMarker index="06" label="Session" />
        <div className="rounded-ledger border border-line bg-raised p-6">
          <p className="text-[14px] text-muted">
            You’re signed in securely. For patient-data safety you’ll be signed
            out automatically after 30 minutes of inactivity.
          </p>
          <div className="mt-5 max-w-xs">
            <SignOutButton />
          </div>
        </div>
      </section>
    </div>
  );
}
