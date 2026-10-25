"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Cream field surface with a soft coral focus ring and a gentle scale. */
const FIELD =
  "h-12 rounded-field border-paper-line bg-field pl-11 pr-3.5 text-[15px] text-paper-ink shadow-field transition-all duration-200 ease-out placeholder:text-paper-muted focus:scale-[1.012] focus:border-accent focus:ring-4 focus:ring-accent-ring focus:outline-none";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(friendlyAuthError(signInError.message));
      setLoading(false);
      return;
    }

    const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : "/home";
    router.replace(target);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-field border border-accent-ring bg-accent-tint px-4 py-3 text-[13px] text-ink"
        >
          {error}
        </p>
      )}

      <div className="space-y-2.5">
        <Label htmlFor="email">Email</Label>
        <div className="group relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted transition-colors group-focus-within:text-accent"
            aria-hidden="true"
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@organisation.com"
            className={FIELD}
          />
        </div>
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="password">Password</Label>
        <div className="group relative">
          <Lock
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-paper-muted transition-colors group-focus-within:text-accent"
            aria-hidden="true"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className={FIELD}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full text-[12px] tracking-[0.18em] hover:scale-[1.015] hover:shadow-[0_18px_40px_-16px_var(--accent)] hover:brightness-110"
      >
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
        {loading ? "Signing in" : "Sign in"}
      </Button>

      <div className="pt-1 text-center">
        <Link
          href="/forgot-password"
          className="label-mono text-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Forgot password?
        </Link>
      </div>
    </form>
  );
}
