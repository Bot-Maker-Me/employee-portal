/**
 * Web-push helpers.
 *
 * The VAPID *public* key only identifies this server to the push service, so it
 * is safe to ship to the browser: it is read from NEXT_PUBLIC_VAPID_PUBLIC_KEY
 * and falls back to the project key so notifications work out of the box.
 *
 * The VAPID *private* key signs push requests. It lives only in the server
 * environment (VAPID_PRIVATE_KEY) and is never exposed to the client.
 */
const FALLBACK_VAPID_PUBLIC_KEY =
  "BLA4-5tiOD0BZo0RUpvA-vijqTP-I2jXXbcT7Y6tcR0K7Hflg7a3bcS6iItJxQiECrkaDsL6jkDZbOYyYCX3YW4";

/** Returns a valid, trimmed VAPID public key, else null. */
export function getVapidPublicKey(): string | null {
  const key =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ||
    FALLBACK_VAPID_PUBLIC_KEY;
  if (!key) return null;
  // An uncompressed P-256 point: starts with "B", ~87 URL-safe base64 chars.
  if (!/^B[A-Za-z0-9_-]{80,100}$/.test(key)) return null;
  return key;
}

export function isVapidKeyConfigured(): boolean {
  return getVapidPublicKey() !== null;
}

/** First 6 characters only — safe to show in diagnostics. */
export function vapidKeyPrefix(): string {
  return getVapidPublicKey()?.slice(0, 6) ?? "";
}

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
