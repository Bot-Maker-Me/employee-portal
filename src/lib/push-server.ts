import { sendNotification, setVapidDetails } from "web-push";
import { getVapidPublicKey } from "@/lib/push";

/**
 * Server-only sender for Web Push.
 *
 * VAPID details come from the environment:
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY  (public, also used by the browser)
 *   VAPID_PRIVATE_KEY             (secret — server only, never NEXT_PUBLIC_*)
 *   VAPID_SUBJECT                 (optional contact, defaults to a mailto)
 *
 * The private key is read here at call time and never leaves the server.
 */

export type PushTarget = {
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function getPrivateKey(): string {
  return process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
}

function getSubject(): string {
  return (
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@employee-portal.local"
  );
}

/** True when both halves of the VAPID keypair are available server-side. */
export function isPushSendConfigured(): boolean {
  return Boolean(getPrivateKey() && getVapidPublicKey());
}

let configured = false;

function ensureConfigured() {
  const publicKey = getVapidPublicKey();
  const privateKey = getPrivateKey();
  if (!publicKey || !privateKey) throw new Error("PUSH_NOT_CONFIGURED");
  if (!configured) {
    setVapidDetails(getSubject(), publicKey, privateKey);
    configured = true;
  }
}

/**
 * Sends one payload to each subscription. Subscriptions the push service has
 * dropped (404/410) are reported back so the caller can delete them.
 */
export async function sendPush(
  targets: PushTarget[],
  payload: PushPayload,
): Promise<{ sent: number; stale: string[] }> {
  ensureConfigured();
  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    targets.map(async (target) => {
      if (!target.p256dh || !target.auth) {
        stale.push(target.endpoint);
        return;
      }
      try {
        await sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          body,
          { TTL: 3600 },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(target.endpoint);
      }
    }),
  );

  return { sent, stale };
}
