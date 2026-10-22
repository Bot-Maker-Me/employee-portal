"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionMarker } from "@/components/section-marker";
import { Wordmark } from "@/components/wordmark";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Please choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don’t match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(friendlyAuthError(updateError.message));
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    router.replace("/home");
    router.refresh();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-md items-center px-5 py-10">
      <div className="animate-rise">
        <Wordmark />
        <div className="mt-6 rounded-ledger border border-line bg-raised p-6 shadow-raised sm:p-8">
          <SectionMarker index="02" label="New password" />
          <h1 className="mt-4 font-serif text-2xl text-ink">Choose a new password</h1>

          {done ? (
            <p role="status" className="mt-4 text-[14px] text-muted">
              Password updated. Taking you to your portal…
            </p>
          ) : (
            <>
              <p className="mt-1.5 text-[14px] text-muted">
                Use at least 8 characters. You’ll stay signed in afterwards.
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
                  <Label htmlFor="password">New password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={loading} className="w-full">
                  {loading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  )}
                  {loading ? "Updating" : "Update password"}
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
