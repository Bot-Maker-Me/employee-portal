"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 28 * 60 * 1000; // warn at 28 minutes

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "visibilitychange",
] as const;

/**
 * Signs the user out after 30 minutes of inactivity, warning at 28 minutes.
 * Any activity (including returning to the tab) resets the clock.
 */
export function IdleTimeout() {
  const router = useRouter();
  const [warned, setWarned] = useState(false);
  const lastActivity = useRef(Date.now());
  const signingOut = useRef(false);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login?reason=timeout");
    router.refresh();
  }, [router]);

  const registerActivity = useCallback(() => {
    lastActivity.current = Date.now();
    setWarned((prev) => (prev ? false : prev));
  }, []);

  useEffect(() => {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, registerActivity, { passive: true }),
    );

    const interval = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= IDLE_MS) {
        void signOut();
      } else if (idle >= WARN_MS) {
        setWarned(true);
      }
    }, 15 * 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, registerActivity),
      );
      window.clearInterval(interval);
    };
  }, [registerActivity, signOut]);

  if (!warned) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-5 animate-fade-in"
    >
      <div className="w-full max-w-sm rounded-ledger border border-line bg-raised p-6 shadow-raised">
        <span className="label-mono text-accent-soft">Session · Idle</span>
        <h2 className="mt-3 font-serif text-xl text-ink">Still there?</h2>
        <p className="mt-2 text-[14px] text-muted">
          For patient-data safety you’ll be signed out in 2 minutes unless you
          continue.
        </p>
        <div className="mt-5 flex gap-3">
          <Button onClick={registerActivity} className="flex-1">
            Stay signed in
          </Button>
          <Button variant="secondary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
