"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, KeyRound, ShieldAlert, X } from "lucide-react";
import {
  adminRejectResetRequest,
  adminSetTemporaryPassword,
} from "@/lib/admin/actions";
import type { ResetRequestRow } from "@/lib/admin/identity";
import { formatFullStamp } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { TempPasswordReveal } from "@/components/admin/temp-password";

/**
 * Pending "I forgot my password" requests. Setting a temporary password is the
 * only way to help: the app never stores one, so it must be handed over here.
 */
export function PasswordRequests({ requests }: { requests: ResetRequestRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ResetRequestRow | null>(null);
  const [issued, setIssued] = useState<{ title: string; password: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  function issue(request: ResetRequestRow) {
    const userId = request.userId;
    if (!userId) return;
    startTransition(async () => {
      setBusy(request.id);
      setError(null);
      let result: Awaited<ReturnType<typeof adminSetTemporaryPassword>>;
      try {
        result = await adminSetTemporaryPassword({
          userId,
          requestId: request.id,
        });
      } catch {
        setBusy(null);
        setError("We couldn’t complete that request. Please try again.");
        return;
      }
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setConfirming(null);
      setIssued({
        title: `Hand this to ${request.fullName ?? `@${request.username}`}.`,
        password: result.tempPassword ?? "",
      });
      router.refresh();
    });
  }

  function reject(request: ResetRequestRow) {
    startTransition(async () => {
      setBusy(request.id);
      setError(null);
      const result = await adminRejectResetRequest({ requestId: request.id });
      setBusy(null);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p
          role="alert"
          className="max-w-2xl rounded-btn border border-accent/60 bg-accent-tint px-3.5 py-2.5 text-[13px] text-ink"
        >
          {error}
        </p>
      )}

      {issued && (
        <TempPasswordReveal
          title={issued.title}
          password={issued.password}
          onDismiss={() => setIssued(null)}
        />
      )}

      {confirming && (
        <div className="max-w-2xl space-y-3 rounded-ledger border border-warn/60 bg-raised p-5">
          <p className="flex items-start gap-2 text-[14px] text-ink">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            This password is shared across all apps this person uses. They will
            need the new password everywhere.
          </p>
          <p className="text-[13px] text-muted">
            A one-time temporary password will be generated for{" "}
            <span className="text-ink">
              {confirming.fullName ?? `@${confirming.username}`}
            </span>{" "}
            and they must change it when they next sign in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => issue(confirming)}
              disabled={pending || busy !== null}
            >
              {busy === confirming.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Confirm reset
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <div className="rounded-ledger border border-line bg-raised p-6 text-[14px] text-muted">
          No one is waiting for a password reset.
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-ledger border border-line bg-raised">
          {requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-center gap-3 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-ink">
                  {request.fullName ?? "Unnamed user"}
                </p>
                <p className="label-mono truncate text-muted">
                  @{request.username}
                  {request.organization ? ` · ${request.organization}` : ""}
                  {" · "}
                  {formatFullStamp(request.requestedAt)}
                </p>
              </div>

              {request.userId ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setError(null);
                      setConfirming(request);
                    }}
                    disabled={pending || busy !== null}
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    Set temporary password
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => reject(request)}
                    disabled={pending || busy !== null}
                  >
                    {busy === request.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    Reject
                  </Button>
                </>
              ) : (
                <span className="label-mono flex items-center gap-1.5 text-muted">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Account removed — nothing to do
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
