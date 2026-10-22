import { ShieldAlert } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark } from "@/components/wordmark";

/**
 * Fail-closed state: shown when the profile can't be loaded or has no
 * organization. No app data is rendered.
 */
export function UnlinkedAccount() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md animate-rise">
        <Wordmark />
        <div className="mt-6 flex items-start gap-4 rounded-ledger border border-line bg-raised p-6 shadow-raised">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <span className="label-mono text-accent-soft">Account · Unlinked</span>
            <h1 className="mt-2 font-serif text-xl text-ink">
              Your account isn’t linked yet
            </h1>
            <p className="mt-2 text-[14px] text-muted">
              Your account is not linked to an organization yet. Contact your
              administrator.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
