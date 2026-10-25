"use client";

import { useEffect } from "react";

const CURSOR_PREFIX = "push-cursor:";
const INTERVAL_MS = 60_000;

/**
 * Watches for new pharmacy replies while the portal is open and asks the server
 * to push an alert to this user's devices. Alerts are only sent when the tab is
 * in the background — a visible chat already updates itself.
 *
 * The cursor (how far we have already looked) lives in localStorage per user.
 */
export function PushWatcher({ userId }: { userId: string }) {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      return;
    }

    const cursorKey = `${CURSOR_PREFIX}${userId}`;
    let cancelled = false;

    async function check() {
      if (Notification.permission !== "granted") return;
      const since = window.localStorage.getItem(cursorKey);
      try {
        const response = await fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "check",
            since,
            hidden: document.visibilityState !== "visible",
          }),
        });
        if (!response.ok) return;
        const data = (await response.json()) as { cursor?: string };
        if (typeof data.cursor === "string") {
          window.localStorage.setItem(cursorKey, data.cursor);
        }
      } catch {
        // Offline or transient: try again on the next tick.
      }
    }

    const tick = () => {
      if (!cancelled) void check();
    };

    const timer = window.setInterval(tick, INTERVAL_MS);
    document.addEventListener("visibilitychange", tick);
    tick();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId]);

  return null;
}
