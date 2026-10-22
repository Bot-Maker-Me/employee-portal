"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionMarker } from "@/components/section-marker";
import {
  getVapidPublicKey,
  isVapidKeyConfigured,
  urlBase64ToUint8Array,
  vapidKeyPrefix,
} from "@/lib/push";

type Permission = "unsupported" | "default" | "granted" | "denied";

export function NotificationSettings({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}) {
  const [permission, setPermission] = useState<Permission>("default");
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState<null | "enable" | "disable" | "test">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // diagnostics
  const [swRegistered, setSwRegistered] = useState(false);
  const [savedRow, setSavedRow] = useState(false);

  const refresh = useCallback(async () => {
    const isSupported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setSupported(isSupported);
    if (!isSupported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as Permission);

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      setSwRegistered(Boolean(registration));
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;
      setSubscribed(Boolean(subscription));
    } catch {
      setSwRegistered(false);
      setSubscribed(false);
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    setIosHint(
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !standalone,
    );

    const supabase = createClient();
    const { count } = await supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    setSavedRow((count ?? 0) > 0);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setError(null);
    setMessage(null);

    const key = getVapidPublicKey();
    if (!key) {
      setError(
        "Notifications aren’t configured yet. Ask your administrator to set the public VAPID key.",
      );
      return;
    }

    setBusy("enable");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const granted = await Notification.requestPermission();
      setPermission(granted as Permission);
      if (granted !== "granted") {
        setError("Notifications were blocked. Enable them in your browser settings.");
        setBusy(null);
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
        }));

      const json = subscription.toJSON();
      const supabase = createClient();
      const { error: upsertError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: userId,
            endpoint: subscription.endpoint,
            p256dh: json.keys?.p256dh ?? null,
            auth: json.keys?.auth ?? null,
            user_agent: navigator.userAgent,
            app_url: window.location.origin,
          },
          { onConflict: "endpoint" },
        );

      if (upsertError) {
        setError("We couldn’t save your subscription. Please try again.");
      } else {
        setMessage("Notifications are enabled on this device.");
      }
    } catch {
      setError("We couldn’t enable notifications on this device.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  async function disable() {
    setError(null);
    setMessage(null);
    setBusy("disable");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;
      if (subscription) {
        const supabase = createClient();
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);
        await subscription.unsubscribe();
      }
      setMessage("Notifications are turned off on this device.");
    } catch {
      setError("We couldn’t turn off notifications on this device.");
    } finally {
      setBusy(null);
      void refresh();
    }
  }

  async function sendTest() {
    setError(null);
    setMessage(null);
    setBusy("test");
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Employee Portal", {
        body: "This is a test alert. Notifications are working on this device.",
        tag: "test-alert",
        icon: "/icon.svg",
        badge: "/icon.svg",
      });
      setMessage("Test alert sent to this device.");
    } catch {
      setError("We couldn’t show a test alert. Enable notifications first.");
    } finally {
      setBusy(null);
    }
  }

  const status = !supported
    ? "Not supported on this browser"
    : permission === "denied"
      ? "Blocked in browser settings"
      : subscribed
        ? "Enabled on this device"
        : permission === "granted"
          ? "Allowed — not yet enabled on this device"
          : "Not enabled";

  return (
    <section className="max-w-2xl space-y-3">
      <SectionMarker index="07" label="Notifications" />
      <div className="rounded-ledger border border-line bg-raised p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-btn bg-accent-tint text-accent-soft">
            {subscribed ? (
              <BellRing className="h-5 w-5" aria-hidden="true" />
            ) : permission === "denied" ? (
              <BellOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Bell className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <h2 className="font-serif text-xl text-ink">Message alerts</h2>
            <p className="label-mono mt-1 text-muted">{status}</p>
          </div>
        </div>

        <p className="mt-4 text-[14px] text-muted">
          Get a notification when the pharmacy replies or a colleague messages
          you. Alerts show no message content.
        </p>

        {iosHint && (
          <p className="mt-3 rounded-btn border border-line bg-sunken px-3.5 py-2.5 text-[13px] text-muted">
            On iPhone: tap <span className="text-ink">Share</span>, then{" "}
            <span className="text-ink">Add to Home Screen</span>, then open the
            portal from the Home Screen to enable notifications.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] text-accent-soft">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-[13px] text-ok">
            {message}
          </p>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={enable}
            disabled={!supported || busy !== null || subscribed}
          >
            {busy === "enable" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            {subscribed ? "Notifications enabled" : "Enable notifications"}
          </Button>
          <Button
            variant="secondary"
            onClick={disable}
            disabled={!supported || busy !== null || !subscribed}
          >
            Disable
          </Button>
          <Button
            variant="secondary"
            onClick={sendTest}
            disabled={!supported || busy !== null || permission !== "granted"}
          >
            {busy === "test" && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            )}
            Send a test alert
          </Button>
        </div>

        {isAdmin && (
          <dl className="mt-6 space-y-1.5 border-t border-line pt-5">
            <p className="label-mono text-accent-soft">Diagnostic · admin</p>
            <Row label="Public key configured" value={isVapidKeyConfigured() ? "Yes" : "No"} />
            <Row label="Key prefix" value={vapidKeyPrefix() || "—"} />
            <Row label="Service worker registered" value={swRegistered ? "Yes" : "No"} />
            <Row label="Permission" value={permission} />
            <Row label="Subscription saved" value={savedRow ? "Yes" : "No"} />
          </dl>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="label-mono text-muted">{label}</dt>
      <dd className="label-mono text-ink">{value}</dd>
    </div>
  );
}
