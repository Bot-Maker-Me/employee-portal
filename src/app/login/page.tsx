import { Background } from "@/components/login/background";
import { Hero } from "@/components/login/hero";
import { RegisterCard } from "@/components/login/register-card";
import { LoginForm } from "@/components/login-form";
import { inter } from "@/lib/fonts";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; error?: string; reason?: string };
}) {
  const redirectTo =
    typeof searchParams.redirectTo === "string" ? searchParams.redirectTo : undefined;
  const timedOut = searchParams.reason === "timeout";

  return (
    <div
      className={`${inter.className} relative flex min-h-dvh flex-col overflow-x-clip`}
    >
      <Background />

      {/* Status pill. */}
      <div
        className="absolute right-5 top-5 z-20 hidden animate-fade-in items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 backdrop-blur-md sm:flex"
        style={{ animationDelay: "1.6s" }}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        <span className="label-mono text-muted">All systems operational</span>
      </div>

      <main className="scroll-slim relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20 lg:px-8">
        {/* Hero + register card. */}
        <section className="order-2 lg:order-1">
          <Hero />
          <div className="mt-12 origin-left scale-[0.92] md:scale-100">
            <RegisterCard />
          </div>
        </section>

        {/* Credentials. */}
        <section className="order-1 lg:order-2">
          {timedOut && (
            <p
              role="status"
              className="mb-4 animate-fade-in rounded-field border border-line bg-sunken px-4 py-3 text-[13px] text-muted"
            >
              You were signed out after a period of inactivity.
            </p>
          )}
          <LoginForm redirectTo={redirectTo} />
        </section>
      </main>

      <footer
        className="relative z-10 animate-fade-in px-5 pb-6 text-center"
        style={{ animationDelay: "2.2s" }}
      >
        <p className="label-mono text-muted opacity-60">
          © 2026 · Encrypted · Role-based access · Every action logged
        </p>
      </footer>
    </div>
  );
}
