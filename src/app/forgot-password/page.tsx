import Link from "next/link";
import { SectionMarker } from "@/components/section-marker";
import { Wordmark } from "@/components/wordmark";
import { ResetRequestForm } from "@/components/reset-request-form";

/**
 * "Forgot password? Ask your administrator."
 *
 * There is no email reset in this app: the request only queues a note for an
 * administrator, who sets a temporary password and forces a change at the next
 * sign-in.
 */
export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md items-center px-5 py-10">
      <div className="animate-rise">
        <Wordmark />
        <div className="mt-6 rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="01" label="Recovery" />
          <h1 className="mt-4 font-serif text-2xl text-ink">
            Forgot your password?
          </h1>
          <p className="mt-1.5 text-[14px] text-muted">
            Enter your username and an administrator will set a temporary
            password for you. There is no reset email — give them a call or ask
            in person, then choose your own password the next time you sign in.
          </p>

          <ResetRequestForm />

          <div className="mt-5 text-center">
            <Link
              href="/login"
              className="label-mono text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
