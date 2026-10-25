import Link from "next/link";
import { LedgerPreview } from "@/components/ledger-preview";
import { LoginForm } from "@/components/login-form";
import { SectionMarker } from "@/components/section-marker";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string; reason?: string };
}) {
  const redirectTo =
    typeof searchParams.redirectTo === "string" ? searchParams.redirectTo : undefined;
  const timedOut = searchParams.reason === "timeout";

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center px-5 py-14 lg:px-8">
      <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        {/* ---------------------------------------------------------------
            Left column — the editorial statement.
        ---------------------------------------------------------------- */}
        <section className="animate-rise">
          <p className="label-mono text-accent">Employee Portal</p>

          <SectionMarker index="01" label="Sign in" className="mt-7" />

          <h1 className="mt-6 max-w-[32rem] font-serif text-[2.6rem] leading-[1.06] tracking-[-0.012em] text-ink sm:text-[3.05rem] lg:text-[3.35rem]">
            Every conversation,{" "}
            <span className="text-glow text-accent">LOGGED</span> and secure.
          </h1>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
            A calm, auditable space for pharmacy teams — internal chat and
            pharmacy chat channels, kept in a single register.
          </p>

          <div className="mt-12 hidden lg:block">
            <LedgerPreview />
          </div>
        </section>

        {/* ---------------------------------------------------------------
            Right column — the credentials card.
        ---------------------------------------------------------------- */}
        <section
          className="animate-rise"
          style={{ animationDelay: "110ms" }}
        >
          <div className="relative overflow-hidden rounded-panel border border-glass-border bg-glass p-7 shadow-glass backdrop-blur-2xl sm:p-9">
            {/* A fine line of light along the top edge of the glass. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)]"
            />

            <SectionMarker index="02" label="Credentials" />

            <h2 className="mt-5 font-serif text-[1.7rem] leading-tight text-ink sm:text-3xl">
              Access the portal
            </h2>
            <p className="mt-2.5 text-[14px] leading-relaxed text-muted">
              Sign in, or{" "}
              <Link
                href="/signup"
                className="text-ink underline-offset-4 transition-colors hover:text-accent-soft hover:underline"
              >
                create an account
              </Link>{" "}
              — new accounts are approved by an administrator.
            </p>

            {timedOut && (
              <p
                role="status"
                className="mt-5 rounded-field border border-line bg-sunken px-4 py-3 text-[13px] text-muted"
              >
                You were signed out after a period of inactivity.
              </p>
            )}

            <LoginForm redirectTo={redirectTo} />
          </div>
        </section>
      </div>
    </main>
  );
}
