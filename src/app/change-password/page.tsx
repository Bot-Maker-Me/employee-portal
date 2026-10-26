import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth/session";
import { getProfile } from "@/lib/profile";
import { isUserActive } from "@/lib/app-status";
import { Wordmark } from "@/components/wordmark";
import { SectionMarker } from "@/components/section-marker";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AccountDeactivated } from "@/components/account-deactivated";

/**
 * The password change page. Middleware sends anyone with
 * `must_change_password` here — from any URL — and lets nobody else through, so
 * a temporary password cannot be used to reach the portal.
 */
export default async function ChangePasswordPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const [active, profile] = await Promise.all([
    isUserActive(userId).catch(() => false),
    getProfile(userId),
  ]);
  if (!active) return <AccountDeactivated />;

  const forced = Boolean(profile?.must_change_password);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md items-center px-5 py-10">
      <div className="animate-rise">
        <Wordmark />
        <div className="mt-6 rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="04" label="Password" />
          <h1 className="mt-4 font-serif text-2xl text-ink">
            {forced ? "Set a new password" : "Change your password"}
          </h1>
          <p className="mt-1.5 mb-6 text-[14px] text-muted">
            {forced
              ? "You signed in with a temporary password. Choose your own password to continue — nothing else is available until you do."
              : "Confirm your current password, then choose a new one."}
          </p>
          <ChangePasswordForm forced={forced} />
        </div>
      </div>
    </main>
  );
}
