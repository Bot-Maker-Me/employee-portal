"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { requestPasswordReset } from "@/lib/auth/reset-actions";
import { USERNAME_HINT } from "@/lib/auth/username";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Asks an administrator for a temporary password. The response is identical
 * whether or not the username exists, so this form cannot confirm an account.
 */
export function ResetRequestForm() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setMessage(null);
    setPending(true);

    let result: Awaited<ReturnType<typeof requestPasswordReset>>;
    try {
      result = await requestPasswordReset({ username });
    } catch {
      setPending(false);
      setError("We couldn’t complete that request. Please try again.");
      return;
    }

    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message);
    setUsername("");
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      {error && (
        <p
          role="alert"
          className="rounded-btn border border-accent-ring bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-btn border border-ok/50 bg-raised px-3.5 py-2.5 text-[13px] text-ok"
        >
          {message}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="reset-username">Username</Label>
        <Input
          id="reset-username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="your.username"
        />
        <p className="text-[12px] text-muted">{USERNAME_HINT}</p>
      </div>

      <Button type="submit" disabled={pending || username.trim().length === 0} className="w-full">
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {pending ? "Sending" : "Notify my administrator"}
      </Button>
    </form>
  );
}
