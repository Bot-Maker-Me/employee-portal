"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionMarker } from "@/components/section-marker";
import { Wordmark } from "@/components/wordmark";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/reset-password");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: redirectTo.href },
    );

    if (resetError) {
      setError(friendlyAuthError(resetError.message));
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md items-center px-5 py-10">
      <div className="animate-rise">
        <Wordmark />
        <div className="mt-6 rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="01" label="Recovery" />
          <h1 className="mt-4 font-serif text-2xl text-ink">Reset your password</h1>

          {sent ? (
            <p role="status" className="mt-4 text-[14px] text-muted">
              If an account exists for{" "}
              <span className="text-ink">{email.trim()}</span>, we’ve sent a
              reset link. Check your inbox and follow it to choose a new
              password.
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[14px] text-muted">
                Enter your work email and we’ll send a secure link.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
                {error && (
                  <p
                    role="alert"
                    className="rounded-btn border border-accent/60 bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
                  >
                    {error}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@organisation.com"
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  {loading ? "Sending" : "Send reset link"}
                </Button>
              </form>
            </>
          )}

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
