import Link from "next/link";
import { LedgerPreview } from "@/components/ledger-preview";
import { LoginForm } from "@/components/login-form";
import { SectionMarker } from "@/components/section-marker";
import { Wordmark } from "@/components/wordmark";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string; reason?: string };
}) {
  const redirectTo =
    typeof searchParams.redirectTo === "string" ? searchParams.redirectTo : undefined;
  const timedOut = searchParams.reason === "timeout";

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-12 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">
      <section className="animate-rise">
        <Wordmark />
        <SectionMarker index="01" label="Sign in" className="mt-10" />
        <h1 className="mt-5 max-w-lg font-serif text-4xl leading-[1.05] text-ink sm:text-5xl">
          Every conversation, <span className="text-accent">LOGGED</span> and
          secure.
        </h1>
        <p className="mt-5 max-w-md text-[15px] text-muted">
          A calm, auditable space for pharmacy teams — internal chat and
          pharmacy topic channels, kept in a single register.
        </p>
        <div className="mt-10 hidden lg:block">
          <LedgerPreview />
        </div>
      </section>

      <section className="animate-rise">
        <div className="rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="02" label="Credentials" />
          <h2 className="mt-4 font-serif text-2xl text-ink">Access the portal</h2>
          <p className="mt-1.5 text-[14px] text-muted">
            Sign in, or{" "}
            <Link
              href="/signup"
              className="text-ink underline-offset-4 hover:text-accent-soft hover:underline"
            >
              create an account
            </Link>{" "}
            — new accounts are approved by an administrator.
          </p>
          {timedOut && (
            <p
              role="status"
              className="mt-4 rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[13px] text-muted"
            >
              You were signed out after a period of inactivity.
            </p>
          )}
          <LoginForm redirectTo={redirectTo} />
        </div>
      </section>
    </main>
  );
}
