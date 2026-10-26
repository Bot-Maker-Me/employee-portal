"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The ONLY place a temporary password is ever visible. It is shown once, is not
 * stored, logged, emailed or audited — closing this panel loses it for good.
 */
export function TempPasswordReveal({
  title,
  password,
  onDismiss,
}: {
  title: string;
  password: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="alert"
      className="rounded-ledger border border-accent-ring bg-accent-tint p-5"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent-soft" aria-hidden="true" />
        <span className="label-mono text-accent-soft">Temporary password</span>
      </div>
      <p className="mt-2 text-[14px] text-ink">{title}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="select-all rounded-btn border border-line bg-bg px-3 py-2 font-mono text-[15px] tracking-wide text-ink">
          {password}
        </code>
        <Button variant="secondary" onClick={copy}>
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-[13px] text-warn">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Give this to the user in person or by phone. It will not be shown again,
        and it is not stored, emailed or written to the audit log.
      </p>
    </div>
  );
}

/**
 * The same "shown once" panel for a batch of freshly created accounts.
 * Copy-all is the intended path: hand each person their own line.
 */
export function TempPasswordList({
  title,
  entries,
  onDismiss,
}: {
  title: string;
  entries: { username: string; tempPassword: string }[];
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const asText = entries
    .map((entry) => `${entry.username}  ${entry.tempPassword}`)
    .join("\n");

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(asText);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      role="alert"
      className="rounded-ledger border border-accent-ring bg-accent-tint p-5"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-accent-soft" aria-hidden="true" />
        <span className="label-mono text-accent-soft">
          Temporary passwords · {entries.length}
        </span>
      </div>
      <p className="mt-2 text-[14px] text-ink">{title}</p>

      <div className="scroll-slim mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-btn border border-line bg-bg p-3">
        {entries.map((entry) => (
          <div key={entry.username} className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[13px] text-ink">
              @{entry.username}
            </span>
            <code className="select-all font-mono text-[13px] text-muted">
              {entry.tempPassword}
            </code>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={copyAll}>
          {copied ? (
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied all" : "Copy all"}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Done
        </Button>
      </div>

      <p className="mt-3 flex items-start gap-2 text-[13px] text-warn">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        These are shown once and are never stored, emailed or written to the
        audit log. Each account must set its own password at first sign-in.
      </p>
    </div>
  );
}
