import { ShieldOff } from "lucide-react";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark } from "@/components/wordmark";

/**
 * Fail-closed state for an account that an administrator has deactivated FOR
 * THIS APP. Their data and their access to the sibling apps are untouched — no
 * portal data is rendered here.
 */
export function AccountDeactivated() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-md animate-rise">
        <Wordmark />
        <div className="mt-6 flex items-start gap-4 rounded-ledger border border-line bg-raised p-6 shadow-raised">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
            <ShieldOff className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <span className="label-mono text-accent-soft">Account · Disabled</span>
            <h1 className="mt-2 font-serif text-xl text-ink">
              This account is switched off
            </h1>
            <p className="mt-2 text-[14px] text-muted">
              An administrator has disabled your access to this portal. Your
              messages and data are kept. Contact your administrator if you think
              this is a mistake.
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
