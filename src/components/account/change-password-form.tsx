"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { changePassword } from "@/lib/auth/actions";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_NOTE,
  passwordStrength,
} from "@/lib/auth/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Change password when the current password IS known. Verifying the current
 * password, updating it and revoking the other sessions all happen on the
 * server — never in the browser.
 */
export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  const strength = passwordStrength(newPassword);
  const complete =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setDone(false);

    if (newPassword !== confirmPassword) {
      setError("Those passwords don’t match.");
      return;
    }

    setPending(true);

    let result: Awaited<ReturnType<typeof changePassword>>;
    try {
      result = await changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
    } catch {
      setPending(false);
      setError("We couldn’t complete that request. Please try again.");
      return;
    }

    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPending(false);
    setDone(true);

    if (forced) {
      router.replace("/home");
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-btn border border-accent-ring bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="rounded-btn border border-ok/50 bg-raised px-3.5 py-2.5 text-[13px] text-ok"
        >
          Password updated. Your other sessions have been signed out.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
        {newPassword.length > 0 && (
          <p className="flex items-center gap-2 text-[12px] text-muted">
            <span className="flex gap-1" aria-hidden="true">
              {[1, 2, 3].map((step) => (
                <span
                  key={step}
                  className={cn(
                    "h-1 w-8 rounded-full transition-colors",
                    strength.score >= step
                      ? strength.score === 1
                        ? "bg-warn"
                        : "bg-ok"
                      : "bg-line",
                  )}
                />
              ))}
            </span>
            Strength: <span className="text-ink">{strength.label}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="••••••••"
        />
      </div>

      <p className="text-[13px] text-muted">
        {MIN_PASSWORD_LENGTH} characters or more, different from your username
        and from your current password. {PASSWORD_NOTE}
      </p>

      <Button type="submit" disabled={pending || !complete} className="w-full">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {pending ? "Updating" : "Update password"}
      </Button>
    </form>
  );
}
